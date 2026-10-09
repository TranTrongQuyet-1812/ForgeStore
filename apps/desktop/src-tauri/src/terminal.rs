use std::path::{Path, PathBuf};

/// Xác thực và chuẩn hóa thư mục làm việc an toàn cho Terminal (P3B-18 & D-27).
/// Nếu thư mục đề xuất tồn tại và là directory hợp lệ => sử dụng.
/// Nếu không tồn tại, rỗng hoặc không hợp lệ => fallback về thư mục người dùng (%USERPROFILE%).
pub fn xac_thuc_thu_muc_lam_viec(thu_muc_de_xuat: Option<&str>) -> PathBuf {
    if let Some(tm) = thu_muc_de_xuat {
        let trimmed = tm.trim();
        // Chuẩn hóa dấu gạch chéo để chặn triệt để cả mixed slashes: /\, \/, \\, //, \??\
        let normalized = trimmed.replace('/', "\\");
        if !normalized.is_empty()
            && !normalized.starts_with(r"\\")
            && !normalized.starts_with(r"\??\")
        {
            let p = Path::new(trimmed);
            if p.exists() && p.is_dir() {
                if let Ok(canon) = p.canonicalize() {
                    let canon_str = canon.to_string_lossy();
                    // Từ chối nếu sau khi phân giải symlink/junction là đường dẫn mạng UNC
                    if canon_str.starts_with(r"\\?\UNC\") {
                        return dirs::home_dir().unwrap_or_else(|| {
                            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                        });
                    }
                    // Loại bỏ tiền tố verbatim "\\?\" trên Windows nếu có để tương thích cmd/wt
                    if let Some(stripped) = canon_str.strip_prefix(r"\\?\") {
                        return PathBuf::from(stripped);
                    }
                    return canon;
                }
                return p.to_path_buf();
            }
        }
    }

    dirs::home_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    })
}

/// Kiểm tra xem Windows Terminal (wt.exe) có sẵn trên máy hay không (D-27).
pub fn kiem_tra_wt_co_san() -> bool {
    #[cfg(target_os = "windows")]
    {
        // 1. Kiểm tra vị trí mặc định của Windows Apps
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let wt_app_path = PathBuf::from(local_app_data)
                .join("Microsoft")
                .join("WindowsApps")
                .join("wt.exe");
            if wt_app_path.exists() {
                return true;
            }
        }

        // 2. Kiểm tra thông qua lệnh where.exe wt
        if let Ok(out) = std::process::Command::new("where.exe")
            .arg("wt")
            .output()
        {
            if out.status.success() {
                return true;
            }
        }

        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Loại trình dòng lệnh được hỗ trợ
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoaiTerminal {
    WindowsTerminal,
    PowerShell,
    Cmd,
}

impl LoaiTerminal {
    pub fn tu_chuoi(s: Option<&str>) -> Self {
        match s.map(|v| v.trim().to_lowercase()).as_deref() {
            Some("powershell") => LoaiTerminal::PowerShell,
            Some("cmd") => LoaiTerminal::Cmd,
            _ => LoaiTerminal::WindowsTerminal,
        }
    }
}

/// Mã hóa chuỗi script PowerShell sang Base64 UTF-16LE cho cờ `-EncodedCommand` (D-27).
/// Triệt tiêu hoàn toàn rủi ro bị cắt bởi dấu chấm phẩy (;) hoặc ký tự đặc biệt của wt.exe parser.
pub fn ma_hoa_powershell_base64(script: &str) -> String {
    let utf16_bytes: Vec<u8> = script.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    base64_encode(&utf16_bytes)
}

/// Thuật toán mã hóa Base64 chuẩn RFC 4648 không cần crate ngoài.
fn base64_encode(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        result.push(CHARSET[((n >> 18) & 0x3F) as usize] as char);
        result.push(CHARSET[((n >> 12) & 0x3F) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[((n >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(n & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Tạo nội dung script chào an toàn cho PowerShell
pub fn tao_script_chao_powershell() -> String {
    concat!(
        "Write-Host ''; ",
        "Write-Host '=== ForgeStore CLI Terminal Helper ===' -ForegroundColor Cyan; ",
        "Write-Host 'Lệnh cài đặt: ' -NoNewline; ",
        "Write-Host $env:FORGESTORE_CLI_CMD -ForegroundColor Yellow; ",
        "Write-Host 'Nhấn Ctrl+V (nếu đã chép vào Clipboard) hoặc gõ: $env:FORGESTORE_CLI_CMD rồi Enter để chạy.' -ForegroundColor Green; ",
        "Write-Host '';"
    ).to_string()
}

/// Khởi chạy Terminal với câu lệnh truyền an toàn qua biến môi trường (P3B-18 & Quyết định D-27).
/// Tuyệt đối KHÔNG tự chạy lệnh thay người dùng: Lệnh chỉ in ra màn hình và chờ người dùng tự bấm.
/// Tuyệt đối KHÔNG ghép lệnh vào tham số dòng lệnh khởi động shell: Lệnh chỉ truyền qua FORGESTORE_CLI_CMD.
pub fn khoi_chay_terminal_an_toan(
    lenh: &str,
    trinh_terminal: Option<&str>,
    thu_muc_lam_viec: Option<&str>,
) -> Result<(), String> {
    let clean_lenh = lenh.trim();
    if clean_lenh.is_empty() {
        return Err("Câu lệnh CLI không được để trống.".to_string());
    }

    let working_dir = xac_thuc_thu_muc_lam_viec(thu_muc_lam_viec);
    let loai_terminal = LoaiTerminal::tu_chuoi(trinh_terminal);

    #[cfg(target_os = "windows")]
    {
        let working_dir_str = working_dir.to_string_lossy().to_string();
        let encoded_ps_cmd = ma_hoa_powershell_base64(&tao_script_chao_powershell());

        match loai_terminal {
            LoaiTerminal::WindowsTerminal if kiem_tra_wt_co_san() => {
                // Khởi chạy wt.exe mở PowerShell trong thư mục làm việc.
                // Dùng -EncodedCommand với chuỗi Base64 UTF-16LE: hoàn toàn không có dấu ;
                // giúp triệt tiêu 100% việc wt.exe cắt lệnh do hiểu nhầm ; là sub-command delimiter.
                // Loại bỏ -ExecutionPolicy Bypass để không làm hạ chính sách bảo mật của phiên shell.
                let mut cmd = std::process::Command::new("wt.exe");
                cmd.arg("-d").arg(&working_dir_str);
                cmd.arg("powershell.exe");
                cmd.arg("-NoExit");
                cmd.arg("-EncodedCommand").arg(&encoded_ps_cmd);
                cmd.env("FORGESTORE_CLI_CMD", clean_lenh);
                cmd.spawn().map_err(|e| format!("Không thể khởi chạy Windows Terminal: {}", e))?;
            }
            LoaiTerminal::Cmd => {
                // Khởi chạy Command Prompt (cmd.exe)
                // Dùng `set FORGESTORE_CLI_CMD` để hiển thị biến môi trường an toàn,
                // TUYỆT ĐỐI KHÔNG dùng `%FORGESTORE_CLI_CMD%` trong chuỗi cmd /k
                // vì cmd macro preprocessor sẽ diễn dịch ký tự & | thành lệnh thực thi (Command Injection).
                let mut cmd = std::process::Command::new("cmd.exe");
                cmd.current_dir(&working_dir);
                cmd.arg("/k");
                cmd.arg(
                    "@echo off & \
                     echo. & \
                     echo === ForgeStore CLI Terminal Helper === & \
                     echo. & \
                     set FORGESTORE_CLI_CMD & \
                     echo. & \
                     echo Nhan Ctrl+V (neu da chep vao Clipboard) roi Enter de chay. & \
                     echo."
                );
                cmd.env("FORGESTORE_CLI_CMD", clean_lenh);
                cmd.spawn().map_err(|e| format!("Không thể khởi chạy CMD: {}", e))?;
            }
            _ => {
                // Mặc định hoặc Fallback về PowerShell (powershell.exe)
                // Dùng -EncodedCommand và bỏ -ExecutionPolicy Bypass
                let mut cmd = std::process::Command::new("powershell.exe");
                cmd.current_dir(&working_dir);
                cmd.arg("-NoExit");
                cmd.arg("-EncodedCommand").arg(&encoded_ps_cmd);
                cmd.env("FORGESTORE_CLI_CMD", clean_lenh);
                cmd.spawn().map_err(|e| format!("Không thể khởi chạy PowerShell: {}", e))?;
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new("sh");
        cmd.current_dir(&working_dir);
        cmd.arg("-c");
        cmd.arg(
            "echo '=== ForgeStore CLI Terminal Helper ==='; \
             echo \"Lenh cai dat: $FORGESTORE_CLI_CMD\"; \
             echo 'Nhan Ctrl+C hoac exit de thoat'; \
             exec $SHELL"
        );
        cmd.env("FORGESTORE_CLI_CMD", clean_lenh);
        cmd.spawn().map_err(|e| format!("Không thể khởi chạy Shell: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_xac_thuc_thu_muc_lam_viec_hop_le() {
        let temp_dir = env::temp_dir();
        let path_str = temp_dir.to_string_lossy().to_string();
        let result = xac_thuc_thu_muc_lam_viec(Some(&path_str));
        assert!(result.exists(), "Thư mục hợp lệ phải tồn tại");
        assert!(result.is_dir(), "Thư mục hợp lệ phải là directory");
    }

    #[test]
    fn test_xac_thuc_thu_muc_lam_viec_khong_ton_tai_fallback_home() {
        let invalid_path = "Z:\\Path_That_Does_Not_Exist_987654321";
        let result = xac_thuc_thu_muc_lam_viec(Some(invalid_path));
        assert!(result.exists(), "Thư mục fallback phải tồn tại");
        assert!(result.is_dir(), "Thư mục fallback phải là directory");
    }

    #[test]
    fn test_xac_thuc_thu_muc_lam_viec_none_fallback_home() {
        let result = xac_thuc_thu_muc_lam_viec(None);
        assert!(result.exists(), "Thư mục fallback None phải tồn tại");
        assert!(result.is_dir(), "Thư mục fallback None phải là directory");
    }

    #[test]
    fn test_loai_terminal_parsing() {
        assert_eq!(LoaiTerminal::tu_chuoi(Some("windows-terminal")), LoaiTerminal::WindowsTerminal);
        assert_eq!(LoaiTerminal::tu_chuoi(Some("PowerShell")), LoaiTerminal::PowerShell);
        assert_eq!(LoaiTerminal::tu_chuoi(Some("cmd")), LoaiTerminal::Cmd);
        assert_eq!(LoaiTerminal::tu_chuoi(Some("CMD")), LoaiTerminal::Cmd);
        assert_eq!(LoaiTerminal::tu_chuoi(None), LoaiTerminal::WindowsTerminal);
        assert_eq!(LoaiTerminal::tu_chuoi(Some("unknown")), LoaiTerminal::WindowsTerminal);
    }

    #[test]
    fn test_khoi_chay_terminal_lenh_rong_bao_loi() {
        let err = khoi_chay_terminal_an_toan("", None, None);
        assert!(err.is_err(), "Lệnh rỗng phải trả về Err");
        let msg = err.err().unwrap();
        assert!(msg.contains("không được để trống"));
    }

    #[test]
    fn test_kiem_tra_wt_co_san_khong_panic() {
        // Hàm kiểm tra wt không được gây crash dù wt có hay không có
        let _ = kiem_tra_wt_co_san();
    }

    #[test]
    fn test_xac_thuc_thu_muc_lam_viec_unc_tu_choi_fallback_home() {
        let unc_path = r"\\attacker.evil.com\share\folder";
        let result = xac_thuc_thu_muc_lam_viec(Some(unc_path));
        assert!(result.exists(), "Thư mục fallback UNC phải tồn tại");
        assert!(result.is_dir(), "Thư mục fallback UNC phải là directory");
        assert!(!result.to_string_lossy().starts_with(r"\\attacker"), "Không được chấp nhận đường dẫn UNC");

        // Kiểm tra mixed slashes
        let mixed_path = r"/\attacker.evil.com\share\folder";
        let result_mixed = xac_thuc_thu_muc_lam_viec(Some(mixed_path));
        assert!(result_mixed.exists());
        assert!(!result_mixed.to_string_lossy().contains("attacker.evil.com"), "Phải chặn mixed slashes UNC");
    }

    #[test]
    fn test_ma_hoa_powershell_base64_khong_chua_cham_phay_hoac_khoang_trang() {
        let script = "Write-Host 'a'; Write-Host 'b'; Write-Host $env:TEST";
        let encoded = ma_hoa_powershell_base64(script);

        // Chuỗi Base64 tuyệt đối không được chứa dấu ; hoặc khoảng trắng hoặc xuống dòng
        assert!(!encoded.contains(';'), "Base64 không được chứa dấu chấm phẩy (;)");
        assert!(!encoded.contains(' '), "Base64 không được chứa khoảng trắng");
        assert!(!encoded.contains('\n'), "Base64 không được chứa xuống dòng");
        assert!(!encoded.contains('"'), "Base64 không được chứa nháy kép");
        assert!(!encoded.contains('\''), "Base64 không được chứa nháy đơn");

        // Kiểm tra tất cả ký tự thuộc bảng mã Base64
        let base64_valid = encoded.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='
        });
        assert!(base64_valid, "Tất cả ký tự phải thuộc bảng mã Base64");
    }

    #[test]
    fn test_tao_script_chao_powershell_hop_le() {
        let script = tao_script_chao_powershell();
        assert!(script.contains("$env:FORGESTORE_CLI_CMD"), "Script phải chứa biến môi trường");
        assert!(script.contains("ForgeStore"), "Script phải chứa tiêu đề ForgeStore");

        let encoded = ma_hoa_powershell_base64(&script);
        assert!(!encoded.is_empty(), "Chuỗi mã hóa không được rỗng");
        assert!(!encoded.contains(';'), "Chuỗi mã hóa không được chứa dấu chấm phẩy");
    }
}
