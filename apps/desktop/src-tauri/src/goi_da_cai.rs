//! P3B-16.8: tự kiểm tra máy đã cài gói chưa bằng chính trình quản lý gói (winget, npm).
//! Chỉ đọc, không cài gì. Gọi thẳng chương trình với danh sách đối số (không qua shell),
//! tên gói kiểm ký tự trước khi chạy nên không chèn được lệnh.

use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Không bật cửa sổ console đen khi kiểm tra.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Tên gói hợp lệ của winget (Publisher.App) và npm (@scope/ten): chữ, số và `. _ - @ /`, không bắt đầu bằng `-`.
pub fn ten_goi_hop_le(ten: &str) -> bool {
    !ten.is_empty()
        && ten.len() <= 214
        && !ten.starts_with('-')
        && ten
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._-@/".contains(c))
}

/// `Some(true/false)` khi kiểm được; `None` khi chưa hỗ trợ trình quản lý đó hoặc máy chưa có nó.
pub fn kiem_tra_goi_da_cai(trinh_quan_ly: &str, ten_goi: &str) -> Result<Option<bool>, String> {
    if !ten_goi_hop_le(ten_goi) {
        return Err(format!("Tên gói không hợp lệ: {}", ten_goi));
    }
    let (chuong_trinh, doi_so): (&str, Vec<&str>) = match trinh_quan_ly {
        "winget" => (
            "winget.exe",
            vec![
                "list",
                "--id",
                ten_goi,
                "--exact",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
        ),
        "npm" => ("npm.cmd", vec!["ls", "-g", ten_goi, "--depth=0", "--json"]),
        _ => return Ok(None),
    };
    let mut lenh = Command::new(chuong_trinh);
    lenh.args(&doi_so);
    #[cfg(windows)]
    lenh.creation_flags(CREATE_NO_WINDOW);
    // Máy chưa cài winget hay Node.js thì không chạy được: coi là không kiểm được, không phải lỗi.
    let Ok(ket_qua) = lenh.output() else {
        return Ok(None);
    };
    let dau_ra = String::from_utf8_lossy(&ket_qua.stdout);
    Ok(Some(match trinh_quan_ly {
        "winget" => {
            ket_qua.status.success() && dau_ra.to_lowercase().contains(&ten_goi.to_lowercase())
        }
        _ => npm_co_goi(&dau_ra, ten_goi),
    }))
}

/// `npm ls -g --json` liệt kê gói toàn cục trong `dependencies`.
fn npm_co_goi(json: &str, ten_goi: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(json)
        .ok()
        .and_then(|v| v.get("dependencies")?.get(ten_goi).cloned())
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ten_goi_hop_le() {
        assert!(ten_goi_hop_le("Microsoft.PowerToys"));
        assert!(ten_goi_hop_le("@anthropic-ai/claude-code"));
        assert!(!ten_goi_hop_le(""));
        assert!(!ten_goi_hop_le("--source=evil"));
        assert!(!ten_goi_hop_le("abc & del C:\\"));
        assert!(!ten_goi_hop_le("abc\"def"));
    }

    #[test]
    fn test_npm_co_goi() {
        let json = r#"{"dependencies":{"typescript":{"version":"5.6.0"}}}"#;
        assert!(npm_co_goi(json, "typescript"));
        assert!(!npm_co_goi(json, "eslint"));
        assert!(!npm_co_goi("{}", "typescript"));
        assert!(!npm_co_goi("khong phai json", "typescript"));
    }

    #[test]
    fn test_trinh_khong_ho_tro_tra_none() {
        assert_eq!(kiem_tra_goi_da_cai("pip", "requests"), Ok(None));
        assert!(kiem_tra_goi_da_cai("winget", "a & b").is_err());
    }
}
