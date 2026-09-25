const SERVICE_NAME: &str = "com.forgestore.desktop";
const USER_ACCOUNT: &str = "refresh_token";

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
            xoa_refresh_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running forgestore desktop application");
}
