use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};

/// Thông tin tiến độ tải tệp nhị phân gửi về UI (P3-08.2)
#[derive(serde::Serialize, Clone, Debug)]
pub struct TienDoTai {
    pub id_tai: String,
    pub da_tai_bytes: u64,
    pub tong_bytes: Option<u64>,
    pub phan_tram: f64,
    pub toc_do_bps: u64,
    pub trang_thai: String, // "DANG_TAI", "XAC_MINH", "HOAN_THANH", "DA_HUY", "LOI"
    pub thong_diep: Option<String>,
}

/// Kết quả sau khi tải và kiểm tra toàn vẹn SHA-256 (P3-08 / P3-09)
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct KetQuaTai {
    pub id_tai: String,
    pub duong_dan_tep: String,
    pub ten_tep: String,
    pub sha256_tinh_duoc: String,
    pub da_xac_minh_sha256: bool,
    pub canh_bao_khong_co_hash: bool,
    pub kich_thuoc_bytes: u64,
}

/// Trình quản lý tiến trình tải tệp và token hủy (P3-08.5)
pub struct TrinhQuanLyTai {
    huy_map: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl TrinhQuanLyTai {
    pub fn new() -> Self {
        Self {
            huy_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn dang_ky(&self, id_tai: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        let mut map = self.huy_map.lock().unwrap();
        map.insert(id_tai.to_string(), Arc::clone(&flag));
        flag
    }

    pub fn huy(&self, id_tai: &str) -> bool {
        let mut map = self.huy_map.lock().unwrap();
        if let Some(flag) = map.remove(id_tai) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn hoan_tat(&self, id_tai: &str) {
        let mut map = self.huy_map.lock().unwrap();
        map.remove(id_tai);
    }
}

/// Lấy thư mục lưu trữ file tải về an toàn tại %LOCALAPPDATA%\ForgeStore\downloads\
pub fn lay_thu_muc_tai_ve() -> Result<PathBuf, String> {
    let base_dir = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."))
        });
    let download_dir = base_dir.join("ForgeStore").join("downloads");
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Không thể tạo thư mục tải về '{}': {}", download_dir.display(), e))?;
    Ok(download_dir)
}

/// Kiểm tra tính toàn vẹn SHA-256 (P3-09)
pub fn kiem_tra_sha256_noi_bo(
    calculated: &str,
    expected: Option<&str>,
) -> Result<(bool, bool), String> {
    match expected {
        Some(exp) if !exp.trim().is_empty() => {
            let exp_clean = exp.trim().to_lowercase();
            let calc_clean = calculated.trim().to_lowercase();
            if exp_clean == calc_clean {
                Ok((true, false))
            } else {
                Err(format!(
                    "LỖI_XAC_MINH_SHA256: Mã băm SHA-256 tải về ({}) không khớp với mã băm kỳ vọng ({}).",
                    calc_clean, exp_clean
                ))
            }
        }
        _ => {
            // Backend không có mã băm: cảnh báo người dùng (P3-09.3)
            Ok((false, true))
        }
    }
}

/// Thực thi tải file dạng stream với reqwest, hỗ trợ resume qua Range, tính SHA-256 nguyên tử và throttle 100ms
pub async fn thuc_thi_tai_tep<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    id_tai: String,
    url: String,
    ten_tep: String,
    sha256_du_kien: Option<String>,
    trinh_quan_ly: Arc<TrinhQuanLyTai>,
    on_progress: Channel<TienDoTai>,
) -> Result<KetQuaTai, String> {
    let cancel_flag = trinh_quan_ly.dang_ky(&id_tai);
    let download_dir = lay_thu_muc_tai_ve()?;
    
    // Sanitize ten_tep: chỉ giữ lại tên tệp thuần túy, loại bỏ các thành phần đường dẫn traversal (Điểm 3)
    let safe_ten_tep = std::path::Path::new(&ten_tep)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("asset.bin")
        .to_string();

    // File tạm mang đuôi .part (P3-08.3)
    let part_path = download_dir.join(format!("{}.part", &safe_ten_tep));
    let final_path = download_dir.join(&safe_ten_tep);

    let client = reqwest::Client::builder()
        .user_agent("ForgeStore-Desktop/0.1.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Không thể khởi tạo HTTP client: {}", e))?;

    // P3-08.6: Kiểm tra resume nếu file .part đã tồn tại
    let mut existing_len = 0u64;
    let mut hasher = Sha256::new();

    if part_path.exists() {
        if let Ok(meta) = tokio::fs::metadata(&part_path).await {
            existing_len = meta.len();
        }
    }

    let mut request_builder = client.get(&url);
    let mut is_resume = false;

    if existing_len > 0 {
        request_builder = request_builder.header("Range", format!("bytes={}-", existing_len));
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối khi tải tệp từ '{}': {}", url, e))?;

    let status = response.status();
    if !status.is_success() && status != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("Máy chủ phản hồi mã lỗi HTTP {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
    }

    let (mut file, mut da_tai_bytes, tong_bytes) = if status == reqwest::StatusCode::PARTIAL_CONTENT && existing_len > 0 {
        is_resume = true;
        // Đọc và băm phần dữ liệu cũ đã có sẵn trong file .part
        let mut old_file = tokio::fs::File::open(&part_path).await
            .map_err(|e| format!("Không thể mở file tạm cũ: {}", e))?;
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            let n = old_file.read(&mut buf).await.map_err(|e| format!("Lỗi đọc file tạm cũ: {}", e))?;
            if n == 0 { break; }
            hasher.update(&buf[..n]);
        }
        
        let content_len = response.content_length().unwrap_or(0);
        let total = existing_len + content_len;

        let mut file_to_append = tokio::fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open(&part_path)
            .await
            .map_err(|e| format!("Không thể mở tiếp file tạm để ghi: {}", e))?;
        file_to_append.seek(tokio::io::SeekFrom::End(0)).await
            .map_err(|e| format!("Không thể seek tới cuối file tạm: {}", e))?;

        (file_to_append, existing_len, Some(total))
    } else {
        // Tải mới từ đầu (Server trả về 200 OK hoặc không có file cũ)
        let total = response.content_length();
        let new_file = tokio::fs::File::create(&part_path).await
            .map_err(|e| format!("Không thể tạo file tạm '.part': {}", e))?;
        (new_file, 0u64, total)
    };

    let mut stream = response.bytes_stream();
    let mut last_emit = Instant::now();
    let mut bytes_since_last_emit = 0u64;

    // Phát sự kiện bắt đầu tải
    let initial_percent = if let Some(tot) = tong_bytes {
        if tot > 0 { (da_tai_bytes as f64 / tot as f64) * 100.0 } else { 0.0 }
    } else { 0.0 };

    let tien_do_khoi_tao = TienDoTai {
        id_tai: id_tai.clone(),
        da_tai_bytes,
        tong_bytes,
        phan_tram: initial_percent,
        toc_do_bps: 0,
        trang_thai: "DANG_TAI".to_string(),
        thong_diep: if is_resume { Some("Đang tiếp tục tải từ điểm gián đoạn...".to_string()) } else { None },
    };
    let _ = on_progress.send(tien_do_khoi_tao.clone());
    let _ = app.emit("download-progress", &tien_do_khoi_tao);

    // Vòng lặp stream chunks (P3-08.1 / P3-08.4)
    while let Some(chunk_result) = stream.next().await {
        // Kiểm tra tín hiệu hủy tải (P3-08.5)
        if cancel_flag.load(Ordering::SeqCst) {
            trinh_quan_ly.hoan_tat(&id_tai);
            drop(file);
            let _ = tokio::fs::remove_file(&part_path).await;
            
            let huy_payload = TienDoTai {
                id_tai: id_tai.clone(),
                da_tai_bytes,
                tong_bytes,
                phan_tram: 0.0,
                toc_do_bps: 0,
                trang_thai: "DA_HUY".to_string(),
                thong_diep: Some("Người dùng đã hủy quá trình tải tệp.".to_string()),
            };
            let _ = on_progress.send(huy_payload.clone());
            let _ = app.emit("download-progress", &huy_payload);
            return Err("DA_HUY: Quá trình tải đã bị hủy bởi người dùng.".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Lỗi mạng khi đang truyền luồng tải: {}", e))?;
        
        // P3-08.4: Tính SHA-256 ngay trong lúc tải
        hasher.update(&chunk);
        
        // P3-08.3: Ghi vào file .part
        file.write_all(&chunk).await
            .map_err(|e| format!("Lỗi ghi dữ liệu vào đĩa: {}", e))?;

        let chunk_len = chunk.len() as u64;
        da_tai_bytes += chunk_len;
        bytes_since_last_emit += chunk_len;

        // P3-08.2: Throttle gửi tiến độ tối đa 10 lần/giây (100ms)
        let now = Instant::now();
        let elapsed = now.duration_since(last_emit);
        if elapsed >= Duration::from_millis(100) {
            let elapsed_secs = elapsed.as_secs_f64();
            let current_speed_bps = if elapsed_secs > 0.0 {
                (bytes_since_last_emit as f64 / elapsed_secs) as u64
            } else {
                0
            };

            let percent = if let Some(tot) = tong_bytes {
                if tot > 0 { ((da_tai_bytes as f64 / tot as f64) * 100.0).min(100.0) } else { 0.0 }
            } else {
                0.0
            };

            let tien_do = TienDoTai {
                id_tai: id_tai.clone(),
                da_tai_bytes,
                tong_bytes,
                phan_tram: (percent * 10.0).round() / 10.0,
                toc_do_bps: current_speed_bps,
                trang_thai: "DANG_TAI".to_string(),
                thong_diep: None,
            };

            let _ = on_progress.send(tien_do.clone());
            let _ = app.emit("download-progress", &tien_do);

            last_emit = now;
            bytes_since_last_emit = 0;
        }
    }

    // Flush đĩa trước khi tính toán mã băm hoàn tất
    file.flush().await
        .map_err(|e| format!("Không thể flush tệp ra đĩa: {}", e))?;
    drop(file);

    // Tính mã băm SHA-256 cuối cùng
    let sha256_tinh_duoc = hex::encode(hasher.finalize());

    // Phát sự kiện chuyển sang trạng thái xác minh SHA-256
    let tien_do_xac_minh = TienDoTai {
        id_tai: id_tai.clone(),
        da_tai_bytes,
        tong_bytes: Some(da_tai_bytes),
        phan_tram: 100.0,
        toc_do_bps: 0,
        trang_thai: "XAC_MINH".to_string(),
        thong_diep: Some("Đang kiểm tra tính toàn vẹn SHA-256...".to_string()),
    };
    let _ = on_progress.send(tien_do_xac_minh.clone());
    let _ = app.emit("download-progress", &tien_do_xac_minh);

    // P3-09: Kiểm tra SHA-256
    let (da_xac_minh, canh_bao_khong_co_hash) = match kiem_tra_sha256_noi_bo(&sha256_tinh_duoc, sha256_du_kien.as_deref()) {
        Ok(result) => result,
        Err(err) => {
            // P3-09.2: Không khớp SHA-256 -> XÓA FILE .part, BÁO LỖI, CHẶN CÀI
            let _ = tokio::fs::remove_file(&part_path).await;
            trinh_quan_ly.hoan_tat(&id_tai);

            let loi_payload = TienDoTai {
                id_tai: id_tai.clone(),
                da_tai_bytes,
                tong_bytes: Some(da_tai_bytes),
                phan_tram: 100.0,
                toc_do_bps: 0,
                trang_thai: "LOI".to_string(),
                thong_diep: Some(err.clone()),
            };
            let _ = on_progress.send(loi_payload.clone());
            let _ = app.emit("download-progress", &loi_payload);
            return Err(err);
        }
    };

    // Đổi tên từ .part sang file chính thức (P3-08.3)
    if final_path.exists() {
        let _ = tokio::fs::remove_file(&final_path).await;
    }
    tokio::fs::rename(&part_path, &final_path).await
        .map_err(|e| format!("Không thể đổi tên file hoàn tất: {}", e))?;

    trinh_quan_ly.hoan_tat(&id_tai);

    let hoan_thanh_payload = TienDoTai {
        id_tai: id_tai.clone(),
        da_tai_bytes,
        tong_bytes: Some(da_tai_bytes),
        phan_tram: 100.0,
        toc_do_bps: 0,
        trang_thai: "HOAN_THANH".to_string(),
        thong_diep: Some("Tải tệp và xác minh toàn vẹn thành công!".to_string()),
    };
    let _ = on_progress.send(hoan_thanh_payload.clone());
    let _ = app.emit("download-progress", &hoan_thanh_payload);

    Ok(KetQuaTai {
        id_tai,
        duong_dan_tep: final_path.to_string_lossy().to_string(),
        ten_tep: safe_ten_tep,
        sha256_tinh_duoc,
        da_xac_minh_sha256: da_xac_minh,
        canh_bao_khong_co_hash,
        kich_thuoc_bytes: da_tai_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kiem_tra_sha256_hop_le() {
        let hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let res = kiem_tra_sha256_noi_bo(hash, Some("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"));
        assert_eq!(res.unwrap(), (true, false));
    }

    #[test]
    fn test_kiem_tra_sha256_sai_ma_bam() {
        let hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let res = kiem_tra_sha256_noi_bo(hash, Some("0000000000000000000000000000000000000000000000000000000000000000"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("LỖI_XAC_MINH_SHA256"));
    }

    #[test]
    fn test_kiem_tra_sha256_khong_co_hash() {
        let hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let res = kiem_tra_sha256_noi_bo(hash, None);
        assert_eq!(res.unwrap(), (false, true));

        let res_empty = kiem_tra_sha256_noi_bo(hash, Some("   "));
        assert_eq!(res_empty.unwrap(), (false, true));
    }

    #[test]
    fn test_trinh_quan_ly_tai_huy() {
        let ql = TrinhQuanLyTai::new();
        let flag = ql.dang_ky("test-id-1");
        assert_eq!(flag.load(Ordering::SeqCst), false);

        let huy_res = ql.huy("test-id-1");
        assert!(huy_res);
        assert_eq!(flag.load(Ordering::SeqCst), true);

        // Hủy lần 2 trả về false vì đã xóa khỏi map
        assert_eq!(ql.huy("test-id-1"), false);
    }
}
