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

    // 1. Che giấu Bearer tokens (hỗ trợ nhiều token, an toàn với Unicode UTF-8)
    let mut cur_search = 0;
    while cur_search < cleaned.len() {
        let mut found_token_start = None;
        let remaining = &cleaned[cur_search..];
        for (byte_offset, _) in remaining.char_indices() {
            let candidate = &remaining[byte_offset..];
            if candidate.len() >= 7
                && candidate.is_char_boundary(7)
                && candidate[..7].eq_ignore_ascii_case("bearer ")
            {
                found_token_start = Some(cur_search + byte_offset + 7);
                break;
            }
        }

        if let Some(abs_start) = found_token_start {
            let token_slice = &cleaned[abs_start..];
            let mut end_rel = token_slice.len();
            for (rel_offset, c) in token_slice.char_indices() {
                if c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == '}' {
                    end_rel = rel_offset;
                    break;
                }
            }

            if end_rel > 0 {
                cleaned.replace_range(abs_start..abs_start + end_rel, "[REDACTED]");
                cur_search = abs_start + 10; // 10 tương đương độ dài của chuỗi "[REDACTED]"
            } else {
                cur_search = abs_start;
            }

            cur_search = cur_search.min(cleaned.len());
            while cur_search < cleaned.len() && !cleaned.is_char_boundary(cur_search) {
                cur_search += 1;
            }
        } else {
            break;
        }
    }

    // 2. Che giấu các trường nhạy cảm trong JSON (hỗ trợ linh hoạt khoảng trắng giữa key, : và ")
    let sensitive_keys = [
        "password",
        "refresh_token",
        "refreshtoken",
        "access_token",
        "accesstoken",
        "token",
        "secret",
        "apikey",
        "api_key",
    ];

    for key in &sensitive_keys {
        let mut cur_search = 0;
        let target_key = format!("\"{}\"", key);
        while cur_search < cleaned.len() {
            let mut found_key_end = None;
            let remaining = &cleaned[cur_search..];
            for (byte_offset, _) in remaining.char_indices() {
                let candidate = &remaining[byte_offset..];
                if candidate.len() >= target_key.len()
                    && candidate.is_char_boundary(target_key.len())
                    && candidate[..target_key.len()].eq_ignore_ascii_case(&target_key)
                {
                    found_key_end = Some(cur_search + byte_offset + target_key.len());
                    break;
                }
            }

            if let Some(key_end) = found_key_end {
                let after_key = &cleaned[key_end..];
                let chars = after_key.char_indices();
                let mut found_colon = false;
                let mut val_start_rel = None;

                for (idx, c) in chars {
                    if !found_colon {
                        if c.is_whitespace() {
                            continue;
                        } else if c == ':' {
                            found_colon = true;
                        } else {
                            break;
                        }
                    } else {
                        if c.is_whitespace() {
                            continue;
                        } else if c == '"' {
                            val_start_rel = Some(idx + 1);
                            break;
                        } else {
                            break;
                        }
                    }
                }

                if let Some(rel_val_start) = val_start_rel {
                    let abs_val_start = key_end + rel_val_start;
                    let val_slice = &cleaned[abs_val_start..];
                    let mut prev_char = '\0';
                    let mut val_end_rel = None;
                    for (idx, c) in val_slice.char_indices() {
                        if c == '"' && prev_char != '\\' {
                            val_end_rel = Some(idx);
                            break;
                        }
                        prev_char = c;
                    }

                    if let Some(rel_val_end) = val_end_rel {
                        cleaned.replace_range(abs_val_start..abs_val_start + rel_val_end, "[REDACTED]");
                        cur_search = abs_val_start + 10;
                    } else {
                        cur_search = key_end;
                    }
                    cur_search = cur_search.min(cleaned.len());
                    while cur_search < cleaned.len() && !cleaned.is_char_boundary(cur_search) {
                        cur_search += 1;
                    }
                } else {
                    cur_search = key_end;
                }
            } else {
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
        let test_file = temp_dir.join("test_rotate.log");

        // 1. Tạo tệp và giả lập dung lượng đạt 5MB (MAX_LOG_SIZE_BYTES)
        let file = std::fs::File::create(&test_file).expect("Tạo file test");
        file.set_len(MAX_LOG_SIZE_BYTES)
            .expect("Đặt dung lượng file 5MB");
        drop(file);

        assert!(test_file.exists());
        assert_eq!(
            std::fs::metadata(&test_file).unwrap().len(),
            MAX_LOG_SIZE_BYTES
        );

        // 2. Kích hoạt hàm xoay log thực tế
        kiem_tra_va_xoay_log(&test_file);

        // 3. Xác nhận tệp .log.old đã được tạo và tệp gốc đã được di chuyển
        let old_file = test_file.with_extension("log.old");
        assert!(old_file.exists(), "Tệp sao lưu .log.old phải được tạo");
        assert!(!test_file.exists(), "Tệp log cũ phải được di chuyển sang .old");

        // Dọn dẹp
        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_lam_sach_thong_diep_da_bearer_va_unicode() {
        let input = "Người dùng Đăng nhập với Bearer token_one_123 và gọi tiếp Bearer token_two_456 tại máy chủ Hà Nội";
        let cleaned = lam_sach_thong_diep_log(input);
        assert!(!cleaned.contains("token_one_123"), "Phải che token 1");
        assert!(!cleaned.contains("token_two_456"), "Phải che token 2");
        assert!(cleaned.contains("Bearer [REDACTED]"), "Phải thay bằng [REDACTED]");
        assert!(cleaned.contains("Người dùng Đăng nhập"), "Phải bảo toàn tiếng Việt UTF-8");
        assert!(cleaned.contains("tại máy chủ Hà Nội"), "Phải bảo toàn phần đuôi tiếng Việt");
    }

    #[test]
    fn test_lam_sach_thong_diep_bearer_nhieu_khoang_trang_tieng_viet() {
        // Kiểm tra kịch bản biên: Bearer có nhiều khoảng trắng rồi đến chữ tiếng Việt
        let input = "Bearer   Hà Nội và Bearer   Đà Nẵng";
        let cleaned = lam_sach_thong_diep_log(input);
        assert!(cleaned.contains("Hà Nội"), "Phải bảo toàn Unicode tiếng Việt");
        assert!(cleaned.contains("Đà Nẵng"), "Phải bảo toàn Unicode tiếng Việt");
    }

    #[test]
    fn test_lam_sach_thong_diep_json_co_khoang_trang_va_cac_loai_token() {
        let input = r#"{"username": "admin", "password" : "secret123", "access_token": "acc_xyz", "refresh_token" : "ref_abc", "apiKey": "key_789"}"#;
        let cleaned = lam_sach_thong_diep_log(input);
        assert!(!cleaned.contains("secret123"), "Phải che password");
        assert!(!cleaned.contains("acc_xyz"), "Phải che access_token");
        assert!(!cleaned.contains("ref_abc"), "Phải che refresh_token");
        assert!(!cleaned.contains("key_789"), "Phải che apiKey");
        assert!(cleaned.contains(r#""password" : "[REDACTED]""#));
        assert!(cleaned.contains(r#""access_token": "[REDACTED]""#));
        assert!(cleaned.contains(r#""refresh_token" : "[REDACTED]""#));
        assert!(cleaned.contains(r#""apiKey": "[REDACTED]""#));
    }
}

