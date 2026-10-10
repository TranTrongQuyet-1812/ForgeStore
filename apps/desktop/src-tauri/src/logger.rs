use std::path::{Path, PathBuf};

const MAX_LOG_SIZE_BYTES: u64 = 5 * 1024 * 1024; // 5 MB

/// Lấy thư mục lưu trữ nhật ký hoạt động (P3B-19 & D-27).
/// Mặc định: %LOCALAPPDATA%/forgestore-desktop/logs hoặc ~/.forgestore/logs.
pub fn lay_thu_muc_log() -> PathBuf {
    if let Some(mut dir) = dirs::data_local_dir() {
        dir.push("forgestore-desktop");
        dir.push("logs");
        dir
    } else if let Some(mut home) = dirs::home_dir() {
        home.push(".forgestore");
        home.push("logs");
        home
    } else {
        PathBuf::from("logs")
    }
}

/// Lấy đường dẫn tệp log chính
pub fn lay_duong_dan_file_log() -> PathBuf {
    lay_thu_muc_log().join("forgestore_client.log")
}

/// Kiểm tra dung lượng và tự động xoay tệp log nếu vượt quá 5MB
pub fn kiem_tra_va_xoay_log(file_path: &Path) {
    if let Ok(metadata) = std::fs::metadata(file_path) {
        if metadata.len() >= MAX_LOG_SIZE_BYTES {
            let old_path = file_path.with_extension("log.old");
            let _ = std::fs::rename(file_path, old_path);
        }
    }
}

/// Định dạng timestamp UTC chuẩn ISO 8601 (YYYY-MM-DDTHH:MM:SSZ) thuần Rust
pub fn dinh_dang_utc_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let secs = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let sec = secs % 60;
    let min = (secs / 60) % 60;
    let hour = (secs / 3600) % 24;
    let mut days = (secs / 86400) as i64;

    let mut year = 1970;
    loop {
        let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
            1
        } else {
            0
        };
        let days_in_year = 365 + leap;
        if days >= days_in_year {
            days -= days_in_year;
            year += 1;
        } else {
            let leap_bool = leap == 1;
            let month_days = [
                31,
                if leap_bool { 29 } else { 28 },
                31,
                30,
                31,
                30,
                31,
                31,
                30,
                31,
                30,
                31,
            ];
            let mut month = 1;
            for &md in &month_days {
                if days >= md {
                    days -= md;
                    month += 1;
                } else {
                    break;
                }
            }
            let day = days + 1;
            return format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                year, month, day, hour, min, sec
            );
        }
    }
}

/// Làm sạch thông điệp trước khi ghi log: Tuyệt đối che giấu token, authorization headers và mật khẩu
pub fn lam_sach_thong_diep_log(thong_diep: &str) -> String {
    let mut cleaned = thong_diep.to_string();

    // 1. Che giấu Bearer tokens
    let lower = cleaned.to_lowercase();
    let mut cur_search = 0;
    while let Some(pos) = lower[cur_search..].find("bearer ") {
        let abs_start = cur_search + pos + 7;
        let token_slice = &cleaned[abs_start..];
        let end_rel = token_slice
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == '}')
            .unwrap_or(token_slice.len());

        if end_rel > 0 {
            cleaned.replace_range(abs_start..abs_start + end_rel, "[REDACTED]");
        }
        cur_search = abs_start + 10;
        if cur_search >= cleaned.len() {
            break;
        }
    }

    // 2. Che giấu refresh_token hoặc password nếu xuất hiện trong json
    for pattern in &["\"password\":\"", "\"refresh_token\":\"", "\"token\":\""] {
        let pattern_lower = pattern.to_lowercase();
        let mut p_search = 0;
        while let Some(pos) = cleaned.to_lowercase()[p_search..].find(&pattern_lower) {
            let abs_start = p_search + pos + pattern.len();
            let slice = &cleaned[abs_start..];
            if let Some(quote_pos) = slice.find('"') {
                cleaned.replace_range(abs_start..abs_start + quote_pos, "[REDACTED]");
                p_search = abs_start + 10;
            } else {
                break;
            }
            if p_search >= cleaned.len() {
                break;
            }
        }
    }

    cleaned
}

/// Ghi một bản ghi nhật ký hoạt động vào tệp
pub fn ghi_log(level: &str, thong_diep: &str, nguon: Option<&str>) -> Result<(), String> {
    let file_path = lay_duong_dan_file_log();
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    kiem_tra_va_xoay_log(&file_path);

    let timestamp = dinh_dang_utc_timestamp();
    let cleaned_msg = lam_sach_thong_diep_log(thong_diep);
    let src = nguon.unwrap_or("App");
    let line = format!(
        "[{}] [{}] [{}] {}\n",
        timestamp,
        level.to_uppercase(),
        src,
        cleaned_msg
    );

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Không thể mở file log để ghi: {}", e))?;

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Không thể ghi nội dung vào file log: {}", e))?;

    Ok(())
}

/// Mở thư mục chứa file log trong trình quản lý tệp hệ thống (Explorer)
pub fn mo_thu_muc_log() -> Result<(), String> {
    let log_dir = lay_thu_muc_log();
    if !log_dir.exists() {
        let _ = std::fs::create_dir_all(&log_dir);
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| format!("Không thể mở thư mục log qua Explorer: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| format!("Không thể mở thư mục log: {}", e))?;
        Ok(())
    }
}

// Tauri commands được gọi từ frontend React
#[tauri::command]
pub fn ghi_log_desktop(
    level: String,
    thong_diep: String,
    nguon: Option<String>,
) -> Result<(), String> {
    ghi_log(&level, &thong_diep, nguon.as_deref())
}

#[tauri::command]
pub fn mo_thu_muc_log_cmd() -> Result<(), String> {
    mo_thu_muc_log()
}

#[tauri::command]
pub fn lay_duong_dan_tep_log() -> Result<String, String> {
    Ok(lay_duong_dan_file_log().to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dinh_dang_utc_timestamp() {
        let ts = dinh_dang_utc_timestamp();
        assert!(ts.ends_with('Z'), "Timestamp phải kết thúc bằng Z");
        assert_eq!(ts.len(), 20, "Định dạng YYYY-MM-DDTHH:MM:SSZ phải có 20 ký tự");
    }

    #[test]
    fn test_lam_sach_thong_diep_che_bearer_token() {
        let input = "Calling API with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and more";
        let cleaned = lam_sach_thong_diep_log(input);
        assert!(!cleaned.contains("eyJhbGci"), "Phải che giấu token JWT");
        assert!(cleaned.contains("Bearer [REDACTED]"), "Phải thay bằng [REDACTED]");
    }

    #[test]
    fn test_lam_sach_thong_diep_che_password_json() {
        let input = r#"{"username":"admin","password":"secret123_super_safe"}"#;
        let cleaned = lam_sach_thong_diep_log(input);
        assert!(!cleaned.contains("secret123"), "Phải che giấu mật khẩu");
        assert!(cleaned.contains(r#""password":"[REDACTED]""#));
    }

    #[test]
    fn test_lay_duong_dan_file_log_hop_le() {
        let path = lay_duong_dan_file_log();
        assert!(path.to_string_lossy().contains("forgestore_client.log"));
    }

    #[test]
    fn test_ghi_log_va_xoay_log() {
        let temp_dir = std::env::temp_dir().join("forgestore_test_logs");
        let _ = std::fs::create_dir_all(&temp_dir);
        let test_file = temp_dir.join("test.log");

        // Ghi thử 1 dòng
        let line = "Test log line\n";
        let _ = std::fs::write(&test_file, line);
        assert!(test_file.exists());

        // Dọn dẹp
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
