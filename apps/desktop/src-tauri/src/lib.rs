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
    match entry.delete_password() {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        .invoke_handler(tauri::generate_handler![
            luu_refresh_token,
            lay_refresh_token,
            xoa_refresh_token,
            lay_thong_tin_thiet_bi
        ])
        .run(tauri::generate_context!())
        .expect("error while running forgestore desktop application");
}
