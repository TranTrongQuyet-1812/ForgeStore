//! P3B-16.8, P3B-30 và P3B-31: tự kiểm tra máy đã cài gói chưa, đọc phiên bản thật của gói,
//! và kiểm tra công cụ quản lý gói có trên máy (npm, pip, docker, winget, scoop). Chỉ đọc,
//! không cài gì. Gọi thẳng chương trình với danh sách đối số cố định (không qua shell),
//! không nhận tên chương trình từ bên ngoài.

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

/// Bảng chương trình và đối số kiểm tra cố định cho từng trình quản lý gói (P3B-31).
/// Chỉ chấp nhận danh sách cố định, không nhận tên chương trình từ bên ngoài để chống chèn lệnh.
pub fn chuong_trinh_kiem_cong_cu(trinh_quan_ly: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match trinh_quan_ly {
        "npm" => Some(("npm.cmd", vec!["--version"])),
        "pip" => Some(("pip.exe", vec!["--version"])),
        "docker" => Some(("docker.exe", vec!["--version"])),
        "winget" => Some(("winget.exe", vec!["--version"])),
        "scoop" => Some(("scoop.cmd", vec!["--version"])),
        _ => None,
    }
}

/// Chạy kiểm tra chương trình với thời gian chờ tối đa (P3B-31).
/// Trả về Some(true) nếu chạy được và thoát mã 0, Some(false) nếu lỗi spawn hoặc mã thoát khác 0,
/// None nếu quá hạn giờ (tiến trình bị kill để không treo giao diện).
fn chay_kiem_tra_co_han_gio(
    chuong_trinh: &str,
    doi_so: &[&str],
    thoi_gian_cho: std::time::Duration,
) -> Option<bool> {
    let mut lenh = Command::new(chuong_trinh);
    lenh.args(doi_so);
    #[cfg(windows)]
    lenh.creation_flags(CREATE_NO_WINDOW);
    lenh.stdin(std::process::Stdio::null());
    lenh.stdout(std::process::Stdio::null());
    lenh.stderr(std::process::Stdio::null());

    let mut tien_trinh = match lenh.spawn() {
        Ok(child) => child,
        Err(_) => return Some(false),
    };

    let bat_dau = std::time::Instant::now();
    loop {
        match tien_trinh.try_wait() {
            Ok(Some(status)) => return Some(status.success()),
            Ok(None) => {
                if bat_dau.elapsed() >= thoi_gian_cho {
                    let _ = tien_trinh.kill();
                    let _ = tien_trinh.wait();
                    return None;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(_) => {
                let _ = tien_trinh.kill();
                let _ = tien_trinh.wait();
                return Some(false);
            }
        }
    }
}

/// Kiểm tra công cụ quản lý gói có khả dụng trên máy không (P3B-31).
/// Hạn giờ 3 giây. Trả về Some(true) nếu có, Some(false) nếu thiếu hoặc mã lỗi, None nếu chưa hỗ trợ hoặc quá giờ.
pub fn kiem_tra_cong_cu(trinh_quan_ly: &str) -> Option<bool> {
    let (chuong_trinh, doi_so) = chuong_trinh_kiem_cong_cu(trinh_quan_ly)?;
    let thoi_gian_cho = std::time::Duration::from_secs(3);

    let ket_qua = chay_kiem_tra_co_han_gio(chuong_trinh, &doi_so, thoi_gian_cho);

    // Trường hợp pip: nếu pip.exe không chạy được (Some(false)), thử tiếp python.exe -m pip --version
    if trinh_quan_ly == "pip" && ket_qua == Some(false) {
        return chay_kiem_tra_co_han_gio("python.exe", &["-m", "pip", "--version"], thoi_gian_cho);
    }

    ket_qua
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

    #[test]
    fn test_chuong_trinh_kiem_cong_cu_hop_le() {
        assert_eq!(
            chuong_trinh_kiem_cong_cu("npm"),
            Some(("npm.cmd", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("pip"),
            Some(("pip.exe", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("docker"),
            Some(("docker.exe", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("winget"),
            Some(("winget.exe", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("scoop"),
            Some(("scoop.cmd", vec!["--version"]))
        );
    }

    #[test]
    fn test_chuong_trinh_kiem_cong_cu_khong_ho_tro_va_chuoi_la() {
        assert_eq!(chuong_trinh_kiem_cong_cu("cargo"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("go"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("npm; calc"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("pip & del C:\\"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu(""), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("winget --help"), None);
    }

    #[test]
    fn test_kiem_tra_cong_cu_khong_ho_tro_tra_none() {
        assert_eq!(kiem_tra_cong_cu("cargo"), None);
        assert_eq!(kiem_tra_cong_cu("go"), None);
        assert_eq!(kiem_tra_cong_cu("npm; calc"), None);
        assert_eq!(kiem_tra_cong_cu(""), None);
    }

    #[test]
    fn test_kiem_tra_cong_cu_hop_le_khong_panic() {
        // Kiểm tra hàm chạy an toàn với công cụ hỗ trợ mà không bị hoảng loạn (panic)
        let _ = kiem_tra_cong_cu("npm");
        let _ = kiem_tra_cong_cu("winget");
    }
}
