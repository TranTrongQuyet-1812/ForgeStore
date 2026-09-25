use std::path::{Path, PathBuf};
use std::process::Command;

/// Kết quả sau khi chạy bộ cài đặt hoặc giải nén (P3-10)
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct KetQuaCaiDat {
    pub thanh_cong: bool,
    pub loai_cai_dat: String, // "EXE", "MSI", "PORTABLE_ZIP"
    pub thong_diep: String,
    pub duong_dan_cai_dat: Option<String>,
    pub duong_dan_thuc_thi: Option<String>,
}

/// Lấy thư mục gốc chứa các app portable được cài đặt: %LOCALAPPDATA%\ForgeStore\apps\<ten_app>\
pub fn lay_thu_muc_cai_dat_app(ten_app: &str) -> Result<PathBuf, String> {
    let base_dir = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."))
        });
    
    // Chuẩn hóa tên app an toàn cho thư mục
    let safe_app_name: String = ten_app
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    let app_dir = base_dir.join("ForgeStore").join("apps").join(safe_app_name);
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Không thể tạo thư mục cài đặt '{}': {}", app_dir.display(), e))?;
    Ok(app_dir)
}

/// Chạy bộ cài Windows .exe (P3-10.1)
pub fn chay_bo_cai_exe(duong_dan_tep: &Path) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp cài đặt .exe không tồn tại: {}", duong_dan_tep.display()));
    }

    #[cfg(target_os = "windows")]
    {
        // Khởi chạy file EXE, Windows tự xử lý hiển thị UAC nếu cần quyền Admin
        Command::new(duong_dan_tep)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy bộ cài đặt .exe: {}", e))?;

        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "EXE".to_string(),
            thong_diep: "Đã khởi chạy bộ cài đặt Windows (.exe) thành công.".to_string(),
            duong_dan_cai_dat: Some(duong_dan_tep.to_string_lossy().to_string()),
            duong_dan_thuc_thi: Some(duong_dan_tep.to_string_lossy().to_string()),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "EXE".to_string(),
            thong_diep: "Môi trường không phải Windows, giả lập mở bộ cài .exe.".to_string(),
            duong_dan_cai_dat: Some(duong_dan_tep.to_string_lossy().to_string()),
            duong_dan_thuc_thi: Some(duong_dan_tep.to_string_lossy().to_string()),
        })
    }
}

/// Chạy bộ cài Windows .msi qua msiexec.exe (P3-10.1)
pub fn chay_bo_cai_msi(duong_dan_tep: &Path) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp cài đặt .msi không tồn tại: {}", duong_dan_tep.display()));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("msiexec.exe")
            .arg("/i")
            .arg(duong_dan_tep)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy msiexec cho tệp .msi: {}", e))?;

        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "MSI".to_string(),
            thong_diep: "Đã khởi chạy Windows Installer (.msi) thành công.".to_string(),
            duong_dan_cai_dat: Some(duong_dan_tep.to_string_lossy().to_string()),
            duong_dan_thuc_thi: None,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "MSI".to_string(),
            thong_diep: "Môi trường không phải Windows, giả lập chạy msiexec.".to_string(),
            duong_dan_cai_dat: Some(duong_dan_tep.to_string_lossy().to_string()),
            duong_dan_thuc_thi: None,
        })
    }
}

/// Giải nén bản Portable .zip và phòng chống lỗ hổng Zip Slip (P3-10.2)
pub fn giai_nen_portable_zip(duong_dan_tep: &Path, ten_app: &str) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp nén .zip không tồn tại: {}", duong_dan_tep.display()));
    }

    let dest_dir = lay_thu_muc_cai_dat_app(ten_app)?;
    let canonical_dest = dest_dir.canonicalize()
        .map_err(|e| format!("Không thể chuẩn hóa đường dẫn đích: {}", e))?;

    let file = std::fs::File::open(duong_dan_tep)
        .map_err(|e| format!("Không thể mở tệp zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Tệp không phải định dạng zip hợp lệ hoặc bị hỏng: {}", e))?;

    let mut potential_exe: Option<PathBuf> = None;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i)
            .map_err(|e| format!("Lỗi khi đọc phần tử zip #{}: {}", i, e))?;

        // Chặn lỗ hổng Zip-Slip (P3-10.2): enclosed_name loại bỏ đường dẫn tương đối ../
        let enclosed_name = match zip_file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                return Err(format!(
                    "CẢNH BÁO AN NINH: Phát hiện tệp zip độc hại (Zip-Slip attempt): '{}'",
                    zip_file.name()
                ));
            }
        };

        let outpath = dest_dir.join(&enclosed_name);

        // Kiểm tra an toàn kép: outpath phải nằm trọn trong dest_dir
        if let Ok(canon_out) = outpath.canonicalize() {
            if !canon_out.starts_with(&canonical_dest) {
                return Err("CẢNH BÁO AN NINH: Tệp giải nén vượt ra ngoài thư mục an toàn!".to_string());
            }
        }

        if zip_file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Không thể tạo thư mục con: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
                }
            }

            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Không thể tạo tệp giải nén '{}': {}", outpath.display(), e))?;
            std::io::copy(&mut zip_file, &mut outfile)
                .map_err(|e| format!("Lỗi khi ghi dữ liệu giải nén: {}", e))?;

            // Ghi nhận file .exe tiềm năng để người dùng mở trực tiếp
            if let Some(ext) = outpath.extension() {
                if ext.eq_ignore_ascii_case("exe") {
                    if potential_exe.is_none() || outpath.file_stem().map_or(false, |s| s.to_string_lossy().to_lowercase().contains(&ten_app.to_lowercase())) {
                        potential_exe = Some(outpath.clone());
                    }
                }
            }
        }
    }

    Ok(KetQuaCaiDat {
        thanh_cong: true,
        loai_cai_dat: "PORTABLE_ZIP".to_string(),
        thong_diep: format!("Đã giải nén bản portable vào '{}' thành công.", dest_dir.display()),
        duong_dan_cai_dat: Some(dest_dir.to_string_lossy().to_string()),
        duong_dan_thuc_thi: potential_exe.map(|p| p.to_string_lossy().to_string()),
    })
}

/// Mở ứng dụng đã cài đặt qua đường dẫn thực thi
pub fn mo_ung_dung_thuc_thi(duong_dan: &Path) -> Result<(), String> {
    if !duong_dan.exists() {
        return Err(format!("Đường dẫn thực thi không tồn tại: {}", duong_dan.display()));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(duong_dan)
            .spawn()
            .map_err(|e| format!("Không thể mở ứng dụng: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lay_thu_muc_cai_dat_app() {
        let res = lay_thu_muc_cai_dat_app("RustDesk App!@#");
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.to_string_lossy().contains("ForgeStore"));
        assert!(path.to_string_lossy().contains("RustDesk_App___"));
    }

    #[test]
    fn test_chay_bo_cai_exe_file_khong_ton_tai() {
        let res = chay_bo_cai_exe(Path::new("C:\\invalid\\path\\nonexistent.exe"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_chay_bo_cai_msi_file_khong_ton_tai() {
        let res = chay_bo_cai_msi(Path::new("C:\\invalid\\path\\nonexistent.msi"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_giai_nen_zip_file_khong_ton_tai() {
        let res = giai_nen_portable_zip(Path::new("C:\\invalid\\path\\nonexistent.zip"), "TestApp");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }
}
