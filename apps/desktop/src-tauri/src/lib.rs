pub mod downloader;
pub mod installer;
pub mod uninstaller;

use downloader::{KetQuaTai, TienDoTai, TrinhQuanLyTai};
use installer::KetQuaCaiDat;
use std::path::Path;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

const SERVICE_NAME: &str = "com.forgestore.desktop";
const USER_ACCOUNT: &str = "refresh_token";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ThongTinThietBi {
    pub dinh_danh_phan_cung: String,
    pub ten_thiet_bi: String,
    pub loai_thiet_bi: String,
}

/// Lưu trữ Refresh Token vào Windows Credential Manager an toàn (P3-03.3)
#[tauri::command]
fn luu_refresh_token(token: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, USER_ACCOUNT)
        .map_err(|e| format!("Không thể khởi tạo Keyring: {}", e))?;
    entry
        .set_password(&token)
        .map_err(|e| format!("Không thể lưu token vào Windows Credential Manager: {}", e))?;
    Ok(())
}

/// Đọc Refresh Token từ Windows Credential Manager (P3-03.3)
#[tauri::command]
fn lay_refresh_token() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, USER_ACCOUNT)
        .map_err(|e| format!("Không thể khởi tạo Keyring: {}", e))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Lỗi khi đọc token từ Windows Credential Manager: {}", e)),
    }
}

/// Xóa Refresh Token trong Windows Credential Manager khi đăng xuất (P3-03.3)
#[tauri::command]
fn xoa_refresh_token() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, USER_ACCOUNT)
        .map_err(|e| format!("Không thể khởi tạo Keyring: {}", e))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Lỗi khi xóa token trong Windows Credential Manager: {}", e)),
    }
}

/// Đọc định danh phần cứng (SHA-256 của MachineGuid từ Registry) và tên máy (P3-04.5)
#[tauri::command]
fn lay_thong_tin_thiet_bi() -> Result<ThongTinThietBi, String> {
    #[cfg(target_os = "windows")]
    {
        use sha2::{Digest, Sha256};
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let crypto_key = hklm
            .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
            .map_err(|e| format!("Không thể mở khóa Cryptography trong Registry: {}", e))?;

        let machine_guid: String = crypto_key
            .get_value("MachineGuid")
            .map_err(|e| format!("Không thể đọc MachineGuid: {}", e))?;

        let mut hasher = Sha256::new();
        hasher.update(machine_guid.as_bytes());
        let hash_bytes = hasher.finalize();
        let dinh_danh_phan_cung = format!("{:x}", hash_bytes);

        let ten_thiet_bi = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".to_string());

        Ok(ThongTinThietBi {
            dinh_danh_phan_cung,
            ten_thiet_bi,
            loai_thiet_bi: "MAY_TINH_WINDOWS".to_string(),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(ThongTinThietBi {
            dinh_danh_phan_cung: "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
            ten_thiet_bi: "Desktop Client".to_string(),
            loai_thiet_bi: "MAY_TINH_WINDOWS".to_string(),
        })
    }
}

/// Tải file asset nhị phân với reqwest stream và tính SHA-256 trực tiếp (P3-08 & P3-09)
#[tauri::command]
async fn tai_tep_cai_dat(
    app: AppHandle,
    id_tai: String,
    url: String,
    ten_tep: String,
    sha256_du_kien: Option<String>,
    trinh_quan_ly: State<'_, Arc<TrinhQuanLyTai>>,
    on_progress: Channel<TienDoTai>,
) -> Result<KetQuaTai, String> {
    downloader::thuc_thi_tai_tep(
        &app,
        id_tai,
        url,
        ten_tep,
        sha256_du_kien,
        trinh_quan_ly.inner().clone(),
        on_progress,
    )
    .await
}

/// Hủy tải tệp và xóa file tạm .part ngay lập tức (P3-08.5)
#[tauri::command]
fn huy_tai_tep(
    id_tai: String,
    trinh_quan_ly: State<'_, Arc<TrinhQuanLyTai>>,
) -> Result<bool, String> {
    Ok(trinh_quan_ly.huy(&id_tai))
}

/// Kiểm tra tính toàn vẹn SHA-256 cho tệp có sẵn trên đĩa (P3-09)
#[tauri::command]
async fn kiem_tra_sha256(
    duong_dan_tep: String,
    sha256_du_kien: Option<String>,
) -> Result<KetQuaTai, String> {
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncReadExt;

    let path = Path::new(&duong_dan_tep);
    let safe_path = installer::kiem_tra_tep_an_toan(path)?;

    let mut file = tokio::fs::File::open(&safe_path)
        .await
        .map_err(|e| format!("Không thể mở tệp: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];

    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| format!("Lỗi khi đọc tệp để tính băm: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    let sha256_tinh_duoc = hex::encode(hasher.finalize());
    let (da_xac_minh, canh_bao_khong_co_hash) =
        downloader::kiem_tra_sha256_noi_bo(&sha256_tinh_duoc, sha256_du_kien.as_deref())?;

    let meta = tokio::fs::metadata(&safe_path)
        .await
        .map_err(|e| format!("Không thể đọc thông tin tệp: {}", e))?;

    let ten_tep = safe_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "asset".to_string());

    Ok(KetQuaTai {
        id_tai: "verify-only".to_string(),
        duong_dan_tep: safe_path.to_string_lossy().to_string(),
        ten_tep,
        sha256_tinh_duoc,
        da_xac_minh_sha256: da_xac_minh,
        canh_bao_khong_co_hash,
        kich_thuoc_bytes: meta.len(),
    })
}

/// Hộp thoại native chọn thư mục hệ thống (A1)
#[tauri::command]
async fn chon_thu_muc(thu_muc_mac_dinh: Option<String>) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new();
        if let Some(dir) = thu_muc_mac_dinh {
            if !dir.trim().is_empty() {
                dialog = dialog.set_directory(dir);
            }
        }
        let folder = dialog.pick_folder();
        Ok(folder.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Lỗi khi mở hộp thoại chọn thư mục: {}", e))?
}

/// Thực thi bộ cài đặt (.exe, .msi) hoặc giải nén bản portable .zip (P3-10, Điểm 4, 7 & A1)
#[tauri::command]
async fn cai_dat_ung_dung(
    duong_dan_tep: String,
    loai_tep: String,
    ten_app: String,
    thu_muc_dich: Option<String>,
) -> Result<KetQuaCaiDat, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&duong_dan_tep);
        let loai_upper = loai_tep.trim().to_uppercase();
        let custom_dest = thu_muc_dich.as_deref().map(Path::new);

        match loai_upper.as_str() {
            "EXE" => installer::chay_bo_cai_exe(path, &ten_app),
            "MSI" => installer::chay_bo_cai_msi(path, &ten_app),
            "ZIP" | "PORTABLE_ZIP" | "ZIP_PORTABLE" => {
                installer::giai_nen_portable_zip(path, &ten_app, custom_dest)
            }
            _ => {
                // Tự động nhận diện đuôi mở rộng nếu không truyền đúng loại
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    match ext.to_lowercase().as_str() {
                        "exe" => installer::chay_bo_cai_exe(path, &ten_app),
                        "msi" => installer::chay_bo_cai_msi(path, &ten_app),
                        "zip" => installer::giai_nen_portable_zip(path, &ten_app, custom_dest),
                        _ => Err(format!("Định dạng tệp không được hỗ trợ để cài đặt: .{}", ext)),
                    }
                } else {
                    Err("Không thể xác định định dạng tệp cài đặt.".to_string())
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Lỗi runtime task khi cài đặt ứng dụng: {}", e))?
}

/// Mở ứng dụng đã cài đặt qua đường dẫn thực thi (A1: cho phép cả app portable)
#[tauri::command]
fn mo_ung_dung(duong_dan_thuc_thi: String, thu_muc_cho_phep: Option<String>) -> Result<(), String> {
    let path = Path::new(&duong_dan_thuc_thi);
    installer::mo_ung_dung_thuc_thi(path, thu_muc_cho_phep.as_deref().map(Path::new))
}

/// Lấy thư mục tải về ForgeStore downloads trên máy
#[tauri::command]
fn lay_thu_muc_tai_ve_cmd() -> Result<String, String> {
    let dir = downloader::lay_thu_muc_tai_ve()?;
    Ok(dir.to_string_lossy().to_string())
}

/// Kiểm tra xem ứng dụng đã được cài đặt thật trong Registry Windows hay chưa (A4, Vấn đề 1)
#[tauri::command]
fn kiem_tra_ung_dung_da_cai_registry(
    ten_app: String,
    registry_key: Option<String>,
    display_name: Option<String>,
) -> Result<Option<uninstaller::ThongTinUngDungRegistry>, String> {
    Ok(uninstaller::tim_ung_dung_chinh_xac_registry(
        &ten_app,
        registry_key.as_deref(),
        display_name.as_deref(),
    ))
}

/// Gỡ cài đặt ứng dụng native qua chuỗi UninstallString chính chủ từ Registry (A4, SEC-01)
#[tauri::command]
async fn go_cai_dat_ung_dung_qua_registry(
    ten_app: String,
    uninstall_string: Option<String>,
    registry_key: Option<String>,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        uninstaller::chay_go_cai_dat_registry_an_toan(
            &ten_app,
            uninstall_string.as_deref(),
            registry_key.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Lỗi khi chạy tiến trình gỡ cài đặt: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let trinh_quan_ly_tai = Arc::new(TrinhQuanLyTai::new());

    tauri::Builder::default()
        .manage(trinh_quan_ly_tai)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            luu_refresh_token,
            lay_refresh_token,
            xoa_refresh_token,
            lay_thong_tin_thiet_bi,
            tai_tep_cai_dat,
            huy_tai_tep,
            kiem_tra_sha256,
            cai_dat_ung_dung,
            mo_ung_dung,
            lay_thu_muc_tai_ve_cmd,
            chon_thu_muc,
            kiem_tra_ung_dung_da_cai_registry,
            go_cai_dat_ung_dung_qua_registry
        ])
        .run(tauri::generate_context!())
        .expect("error while running forgestore desktop application");
}
