//! P3B-16.8 và P3B-30: tự kiểm tra máy đã cài gói chưa, và đọc phiên bản thật của gói, bằng chính trình quản lý
//! gói (winget, npm, pip). Chỉ đọc, không cài gì. Gọi thẳng chương trình với danh sách đối số (không qua shell),
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

/// P3B-30: đọc phiên bản thật của gói đã cài. `None` khi chưa hỗ trợ trình quản lý đó, máy chưa có nó,
/// gói chưa cài hoặc đầu ra không đọc được. Hiện hỗ trợ npm và pip (winget in bảng khó đọc chắc chắn, docker hay là `latest`).
pub fn doc_phien_ban_goi(trinh_quan_ly: &str, ten_goi: &str) -> Result<Option<String>, String> {
    if !ten_goi_hop_le(ten_goi) {
        return Err(format!("Tên gói không hợp lệ: {}", ten_goi));
    }
    match trinh_quan_ly {
        "npm" => Ok(
            chay_chi_doc("npm.cmd", &["ls", "-g", ten_goi, "--depth=0", "--json"])
                .and_then(|dau_ra| npm_phien_ban(&dau_ra, ten_goi)),
        ),
        // Máy có `pip` riêng hoặc chỉ có Python: thử lần lượt, dừng ở cách đầu tiên chạy được
        "pip" => Ok(chay_chi_doc("pip.exe", &["show", ten_goi])
            .or_else(|| chay_chi_doc("python.exe", &["-m", "pip", "show", ten_goi]))
            .and_then(|dau_ra| pip_phien_ban(&dau_ra))),
        _ => Ok(None),
    }
}

/// Chạy một chương trình chỉ để đọc, không qua shell, không bật cửa sổ console. `None` nếu không chạy được
/// (máy chưa cài chương trình đó); chương trình chạy xong dù báo lỗi (ví dụ gói chưa cài) vẫn trả đầu ra.
fn chay_chi_doc(chuong_trinh: &str, doi_so: &[&str]) -> Option<String> {
    let mut lenh = Command::new(chuong_trinh);
    lenh.args(doi_so);
    #[cfg(windows)]
    lenh.creation_flags(CREATE_NO_WINDOW);
    let ket_qua = lenh.output().ok()?;
    Some(String::from_utf8_lossy(&ket_qua.stdout).into_owned())
}

/// Phiên bản hợp lệ để gửi lên máy chủ: khớp luật của backend (chữ, số và `. + _ ~ -`, tối đa 100 ký tự).
fn phien_ban_hop_le(pb: &str) -> bool {
    !pb.is_empty()
        && pb.len() <= 100
        && pb.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && pb
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".+_~-".contains(c))
}

/// `npm ls -g <gói> --json` trả `dependencies.<gói>.version`.
fn npm_phien_ban(json: &str, ten_goi: &str) -> Option<String> {
    let pb = serde_json::from_str::<serde_json::Value>(json)
        .ok()?
        .get("dependencies")?
        .get(ten_goi)?
        .get("version")?
        .as_str()?
        .to_string();
    phien_ban_hop_le(&pb).then_some(pb)
}

/// `pip show <gói>` in các dòng `Khóa: giá trị`, trong đó có `Version: x.y.z`.
fn pip_phien_ban(dau_ra: &str) -> Option<String> {
    let pb = dau_ra
        .lines()
        .find_map(|dong| dong.strip_prefix("Version:"))?
        .trim()
        .to_string();
    phien_ban_hop_le(&pb).then_some(pb)
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
    fn test_npm_phien_ban() {
        let json = r#"{"dependencies":{"typescript":{"version":"5.6.0"}}}"#;
        assert_eq!(npm_phien_ban(json, "typescript"), Some("5.6.0".to_string()));
        assert_eq!(npm_phien_ban(json, "eslint"), None);
        assert_eq!(npm_phien_ban("{}", "typescript"), None);
        assert_eq!(npm_phien_ban("khong phai json", "typescript"), None);
        // Phiên bản chứa ký tự lạ thì bỏ, không gửi lên máy chủ
        let la = r#"{"dependencies":{"x":{"version":"1.0; rm -rf"}}}"#;
        assert_eq!(npm_phien_ban(la, "x"), None);
    }

    #[test]
    fn test_pip_phien_ban() {
        let dau_ra = "Name: requests\nVersion: 2.31.0\nSummary: Python HTTP for Humans.\n";
        assert_eq!(pip_phien_ban(dau_ra), Some("2.31.0".to_string()));
        // CRLF của Windows
        assert_eq!(
            pip_phien_ban("Name: a\r\nVersion: 1.0.0rc1\r\n"),
            Some("1.0.0rc1".to_string())
        );
        // pip báo chưa cài: không có dòng Version
        assert_eq!(pip_phien_ban("WARNING: Package(s) not found: abc"), None);
        assert_eq!(pip_phien_ban("Version: \n"), None);
        assert_eq!(pip_phien_ban("Version: 1 2\n"), None);
    }

    #[test]
    fn test_phien_ban_hop_le() {
        assert!(phien_ban_hop_le("1.2.3"));
        assert!(phien_ban_hop_le("2.0.0-beta.1"));
        assert!(phien_ban_hop_le("1.4.2+build.5"));
        assert!(!phien_ban_hop_le(""));
        assert!(!phien_ban_hop_le("-1.0"));
        assert!(!phien_ban_hop_le(&"1".repeat(101)));
    }

    #[test]
    fn test_doc_phien_ban_khong_ho_tro_hoac_ten_loi() {
        assert_eq!(doc_phien_ban_goi("winget", "Microsoft.PowerToys"), Ok(None));
        assert_eq!(doc_phien_ban_goi("docker", "nginx"), Ok(None));
        assert!(doc_phien_ban_goi("npm", "a & b").is_err());
        assert!(doc_phien_ban_goi("pip", "--index-url=x").is_err());
    }

    #[test]
    fn test_trinh_khong_ho_tro_tra_none() {
        assert_eq!(kiem_tra_goi_da_cai("pip", "requests"), Ok(None));
        assert!(kiem_tra_goi_da_cai("winget", "a & b").is_err());
    }
}
