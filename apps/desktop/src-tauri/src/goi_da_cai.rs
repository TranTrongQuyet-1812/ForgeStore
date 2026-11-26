//! P3B-16.8, P3B-30, P3B-31, P3B-45 và P3B-45.3d: tự kiểm tra máy đã cài gói chưa, đọc phiên bản
//! thật của gói, và kiểm tra trạng thái công cụ dòng lệnh trên máy (npm/npx, pip, docker, winget,
//! scoop, cargo, conda, go; riêng Docker kiểm 2 bước chỉ đọc: đã cài, thiếu WSL và engine đang chạy).
//! Tự nạp PATH mới nhất từ Windows Registry để nhận công cụ vừa cài mà không cần mở lại ứng dụng.
//! Chỉ đọc, không cài gì. Gọi thẳng chương trình với danh sách đối số cố định (không qua shell),
//! không nhận tên chương trình từ bên ngoài.

use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::path::PathBuf;
use std::process::Command;

/// Trạng thái sẵn sàng của công cụ dòng lệnh trên máy người dùng (P3B-45).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrangThaiCongCu {
    SanSang,  // "SAN_SANG"
    ChuaCai,  // "CHUA_CAI"
    ChuaChay, // "CHUA_CHAY" (riêng Docker: đã có docker.exe nhưng engine chưa chạy)
    ThieuWsl, // "THIEU_WSL" (riêng Docker: đã có docker.exe nhưng máy chưa cài/bật WSL)
}

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
    let mut lenh = tao_lenh_voi_path_moi(chuong_trinh, &doi_so);
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

/// Bung các mẫu biến môi trường `%TEN_BIEN%` (không phân biệt hoa thường) cho chuỗi PATH từ Registry (P3B-45.3d).
/// Nếu biến không tồn tại thì giữ nguyên `%TEN_BIEN%`.
pub fn bung_bien_moi_truong(chuoi: &str, tra_cuu: &dyn Fn(&str) -> Option<String>) -> String {
    let mut ket_qua = String::with_capacity(chuoi.len());
    let mut con_lai = chuoi;

    while let Some(dau) = con_lai.find('%') {
        ket_qua.push_str(&con_lai[..dau]);
        let sau_dau = &con_lai[dau + 1..];
        let Some(cuoi) = sau_dau.find('%') else {
            ket_qua.push_str(&con_lai[dau..]);
            return ket_qua;
        };
        let ten_bien = &sau_dau[..cuoi];
        let hop_le = !ten_bien.is_empty() && !ten_bien.contains(['\\', '/']);
        let gia_tri = if hop_le {
            tra_cuu(ten_bien)
                .or_else(|| tra_cuu(&ten_bien.to_ascii_uppercase()))
                .or_else(|| tra_cuu(&ten_bien.to_ascii_lowercase()))
        } else {
            None
        };
        if let Some(gt) = gia_tri {
            ket_qua.push_str(&gt);
        } else {
            ket_qua.push('%');
            ket_qua.push_str(ten_bien);
            ket_qua.push('%');
        }
        con_lai = &sau_dau[cuoi + 1..];
    }

    ket_qua.push_str(con_lai);
    ket_qua
}

/// Ghép các chuỗi PATH (phân cách `;`), bỏ mục rỗng và lọc trùng không phân biệt hoa thường
/// nhưng giữ đúng thứ tự ưu tiên Machine → User → PATH hiện tại của tiến trình (P3B-45.3d).
pub fn ghep_path_khong_trung(danh_sach_path: &[String]) -> String {
    let mut da_thay = HashSet::new();
    let mut ket_qua = Vec::new();

    for chuoi in danh_sach_path {
        for muc in chuoi.split(';') {
            let sach = muc.trim();
            if sach.is_empty() {
                continue;
            }
            let khoa = if sach.len() > 3 {
                sach.trim_end_matches('\\')
            } else {
                sach
            }
            .to_ascii_lowercase();
            if da_thay.insert(khoa) {
                ket_qua.push(sach);
            }
        }
    }

    ket_qua.join(";")
}

/// Đọc PATH mới nhất từ Windows Registry (Machine + User) gộp với PATH của tiến trình (P3B-45.3d).
/// Chỉ đọc; giúp nhận công cụ vừa cài qua winget/Scoop khi ForgeStore đang mở.
fn doc_path_moi_nhat_tu_he_thong() -> Option<OsString> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        use winreg::RegKey;

        let tra_cuu = |ten: &str| std::env::var(ten).ok();
        let mut danh_sach = Vec::new();

        if let Ok(key_may) = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey("SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment")
        {
            if let Ok(path_may) = key_may.get_value::<String, _>("Path") {
                danh_sach.push(bung_bien_moi_truong(&path_may, &tra_cuu));
            }
        }

        if let Ok(key_nguoi_dung) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Environment") {
            if let Ok(path_nguoi_dung) = key_nguoi_dung.get_value::<String, _>("Path") {
                danh_sach.push(bung_bien_moi_truong(&path_nguoi_dung, &tra_cuu));
            }
        }

        if let Ok(path_tien_trinh) = std::env::var("PATH") {
            danh_sach.push(path_tien_trinh);
        }

        let ghep = ghep_path_khong_trung(&danh_sach);
        if ghep.is_empty() {
            std::env::var_os("PATH")
        } else {
            Some(OsString::from(ghep))
        }
    }

    #[cfg(not(windows))]
    {
        std::env::var_os("PATH")
    }
}

/// Tìm tệp thực thi trong chuỗi PATH mới nhất (P3B-45.3d).
/// Nếu `ten_chuong_trinh` đã là đường dẫn có dấu tách thư mục thì giữ nguyên.
pub fn tim_chuong_trinh_trong_path(ten_chuong_trinh: &str, chuoi_path: &OsStr) -> Option<PathBuf> {
    if ten_chuong_trinh.is_empty() {
        return None;
    }
    if ten_chuong_trinh.contains('\\') || ten_chuong_trinh.contains('/') {
        return Some(PathBuf::from(ten_chuong_trinh));
    }
    for thu_muc in std::env::split_paths(chuoi_path) {
        let ung_vien = thu_muc.join(ten_chuong_trinh);
        if ung_vien.is_file() {
            return Some(ung_vien);
        }
    }
    None
}

/// Dựng `Command` chỉ đọc với đường dẫn giải từ PATH mới nhất và gắn `PATH` mới cho tiến trình con (P3B-45.3d).
fn tao_lenh_voi_path_moi(chuong_trinh: impl AsRef<OsStr>, doi_so: &[&str]) -> Command {
    let chuong_trinh_ref = chuong_trinh.as_ref();
    let path_moi = doc_path_moi_nhat_tu_he_thong();
    let duong_dan_chay = path_moi
        .as_deref()
        .and_then(|p| chuong_trinh_ref.to_str().and_then(|ten| tim_chuong_trinh_trong_path(ten, p)));

    let mut lenh = match duong_dan_chay {
        Some(ref duong_dan) => Command::new(duong_dan),
        None => Command::new(chuong_trinh_ref),
    };
    lenh.args(doi_so);
    #[cfg(windows)]
    lenh.creation_flags(CREATE_NO_WINDOW);
    // Truyền PATH mới để các script trung gian (scoop.cmd, npm.cmd, conda.bat) tìm thấy công cụ con.
    if let Some(ref p) = path_moi {
        lenh.env("PATH", p);
    }
    lenh
}

/// Chạy một chương trình chỉ để đọc, không qua shell, không bật cửa sổ console. `None` nếu không chạy được
/// (máy chưa cài chương trình đó); chương trình chạy xong dù báo lỗi (ví dụ gói chưa cài) vẫn trả đầu ra.
fn chay_chi_doc(chuong_trinh: &str, doi_so: &[&str]) -> Option<String> {
    let mut lenh = tao_lenh_voi_path_moi(chuong_trinh, doi_so);
    let ket_qua = lenh.output().ok()?;
    Some(String::from_utf8_lossy(&ket_qua.stdout).into_owned())
}

/// Bảng chương trình và đối số kiểm tra cố định cho từng trình quản lý gói (P3B-31, P3B-45.3d).
/// Chỉ chấp nhận danh sách cố định, không nhận tên chương trình từ bên ngoài để chống chèn lệnh.
pub fn chuong_trinh_kiem_cong_cu(trinh_quan_ly: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match trinh_quan_ly {
        "npm" | "npx" => Some(("npm.cmd", vec!["--version"])),
        "pip" => Some(("pip.exe", vec!["--version"])),
        "docker" => Some(("docker.exe", vec!["--version"])),
        "winget" => Some(("winget.exe", vec!["--version"])),
        "scoop" => Some(("scoop.cmd", vec!["--version"])),
        "cargo" => Some(("cargo.exe", vec!["--version"])),
        "conda" => Some(("conda.exe", vec!["--version"])),
        // `go --version` thoát mã lỗi 2; lệnh đúng của Go là `go version`.
        "go" => Some(("go.exe", vec!["version"])),
        _ => None,
    }
}

/// Đường dẫn mặc định của Docker Desktop khi tiến trình đang mở giữ PATH cũ sau cài đặt (P3B-45).
pub fn duong_dan_docker_mac_dinh(program_files: Option<&OsStr>) -> Option<PathBuf> {
    let goc = program_files?;
    if goc.is_empty() {
        return None;
    }
    Some(
        PathBuf::from(goc)
            .join("Docker")
            .join("Docker")
            .join("resources")
            .join("bin")
            .join("docker.exe"),
    )
}

/// Chạy kiểm tra chương trình với thời gian chờ tối đa (P3B-31, P3B-45, P3B-45.3d).
/// Trả về Some(true) nếu chạy được và thoát mã 0, Some(false) nếu lỗi spawn hoặc mã thoát khác 0,
/// None nếu quá hạn giờ (tiến trình bị kill để không treo giao diện).
fn chay_kiem_tra_co_han_gio(
    chuong_trinh: impl AsRef<OsStr>,
    doi_so: &[&str],
    thoi_gian_cho: std::time::Duration,
) -> Option<bool> {
    let mut lenh = tao_lenh_voi_path_moi(chuong_trinh, doi_so);
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

/// Bước 1 kiểm tra Docker: tìm `docker.exe` trong PATH hoặc thư mục cài mặc định (P3B-45).
/// Trả `Some(Some(lenh))` nếu đã cài, `Some(None)` nếu chưa cài, `None` nếu quá hạn giờ.
fn tim_chuong_trinh_docker(thoi_gian_cho: std::time::Duration) -> Option<Option<OsString>> {
    match chay_kiem_tra_co_han_gio("docker.exe", &["--version"], thoi_gian_cho) {
        Some(true) => return Some(Some(OsString::from("docker.exe"))),
        None => return None,
        Some(false) => {}
    }

    // Tiến trình đang chạy giữ PATH cũ sau khi vừa cài Docker qua winget nên kiểm thêm trên đĩa.
    let Some(duong_dan) = duong_dan_docker_mac_dinh(std::env::var_os("ProgramFiles").as_deref())
    else {
        return Some(None);
    };
    if !duong_dan.is_file() {
        return Some(None);
    }
    match chay_kiem_tra_co_han_gio(&duong_dan, &["--version"], thoi_gian_cho) {
        Some(true) => Some(Some(duong_dan.into_os_string())),
        Some(false) => Some(None),
        None => None,
    }
}

/// Kiểm tra nhanh trạng thái WSL chỉ đọc (hạn giờ 3 giây) để phân biệt thiếu WSL với chưa mở Docker Desktop (P3B-45.3c).
fn kiem_tra_wsl_san_sang() -> Option<bool> {
    chay_kiem_tra_co_han_gio("wsl.exe", &["--status"], std::time::Duration::from_secs(3))
}

/// Kiểm tra Docker 2 bước chỉ đọc: đã cài chưa (3 giây) và engine có đang chạy không (5 giây) (P3B-45, P3B-45.3c).
fn kiem_tra_docker() -> Option<TrangThaiCongCu> {
    let chuong_trinh = match tim_chuong_trinh_docker(std::time::Duration::from_secs(3))? {
        Some(lenh) => lenh,
        None => return Some(TrangThaiCongCu::ChuaCai),
    };

    // Chạy `docker info` chỉ đọc để phân biệt đã cài nhưng chưa bật Docker Desktop với đã sẵn sàng.
    match chay_kiem_tra_co_han_gio(
        &chuong_trinh,
        &["info", "--format", "{{.ServerVersion}}"],
        std::time::Duration::from_secs(5),
    ) {
        Some(true) => Some(TrangThaiCongCu::SanSang),
        Some(false) => {
            // Chỉ kiểm WSL khi `docker info` đã thất bại để không báo nhầm máy chạy Docker bằng Hyper-V.
            if kiem_tra_wsl_san_sang() == Some(false) {
                Some(TrangThaiCongCu::ThieuWsl)
            } else {
                Some(TrangThaiCongCu::ChuaChay)
            }
        }
        None => None,
    }
}

/// Kiểm tra trạng thái công cụ quản lý gói trên máy (P3B-31, P3B-45).
/// Riêng Docker kiểm 2 bước (đã cài và đang chạy); các trình khác kiểm `--version` hạn giờ 3 giây.
pub fn kiem_tra_trang_thai_cong_cu(trinh_quan_ly: &str) -> Option<TrangThaiCongCu> {
    if trinh_quan_ly == "docker" {
        return kiem_tra_docker();
    }

    let (chuong_trinh, doi_so) = chuong_trinh_kiem_cong_cu(trinh_quan_ly)?;
    let thoi_gian_cho = std::time::Duration::from_secs(3);

    let mut ket_qua = chay_kiem_tra_co_han_gio(chuong_trinh, &doi_so, thoi_gian_cho);

    // Trường hợp pip: nếu pip.exe không chạy được (Some(false)), thử tiếp python.exe -m pip --version
    if trinh_quan_ly == "pip" && ket_qua == Some(false) {
        ket_qua = chay_kiem_tra_co_han_gio("python.exe", &["-m", "pip", "--version"], thoi_gian_cho);
    }

    // Miniconda trên Windows thường đưa `condabin\conda.bat` vào PATH thay vì `conda.exe`.
    if trinh_quan_ly == "conda" && ket_qua == Some(false) {
        ket_qua = chay_kiem_tra_co_han_gio("conda.bat", &["--version"], thoi_gian_cho);
    }

    ket_qua.map(|co_san| {
        if co_san {
            TrangThaiCongCu::SanSang
        } else {
            TrangThaiCongCu::ChuaCai
        }
    })
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
    fn test_bung_bien_moi_truong() {
        let tra_cuu = |ten: &str| match ten {
            "USERPROFILE" => Some("C:\\Users\\demo".to_string()),
            "SystemRoot" => Some("C:\\Windows".to_string()),
            _ => None,
        };
        assert_eq!(
            bung_bien_moi_truong("%USERPROFILE%\\scoop\\shims", &tra_cuu),
            "C:\\Users\\demo\\scoop\\shims"
        );
        assert_eq!(
            bung_bien_moi_truong("%userprofile%\\scoop\\shims", &tra_cuu),
            "C:\\Users\\demo\\scoop\\shims"
        );
        assert_eq!(
            bung_bien_moi_truong("%KHONG_CO%\\bin", &tra_cuu),
            "%KHONG_CO%\\bin"
        );
        assert_eq!(
            bung_bien_moi_truong("%SystemRoot%\\System32;%USERPROFILE%\\.cargo\\bin", &tra_cuu),
            "C:\\Windows\\System32;C:\\Users\\demo\\.cargo\\bin"
        );
    }

    #[test]
    fn test_ghep_path_khong_trung() {
        let danh_sach = vec![
            "C:\\Windows\\System32;;C:\\Tools\\bin\\".to_string(),
            "c:\\tools\\bin;C:\\Users\\demo\\scoop\\shims; ".to_string(),
            "C:\\Windows\\System32;C:\\Program Files\\Go\\bin".to_string(),
        ];
        assert_eq!(
            ghep_path_khong_trung(&danh_sach),
            "C:\\Windows\\System32;C:\\Tools\\bin\\;C:\\Users\\demo\\scoop\\shims;C:\\Program Files\\Go\\bin"
        );
    }

    #[test]
    fn test_tim_chuong_trinh_trong_path() {
        let thu_muc_tam = std::env::temp_dir().join(format!(
            "forgestore_path_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&thu_muc_tam);
        std::fs::create_dir_all(&thu_muc_tam).unwrap();
        let tep_gia = thu_muc_tam.join("cong_cu_thu.cmd");
        std::fs::write(&tep_gia, "@echo off\r\n").unwrap();

        let path_thu = OsString::from(format!("Z:\\KhongTonTai;{}", thu_muc_tam.display()));
        assert_eq!(
            tim_chuong_trinh_trong_path("cong_cu_thu.cmd", &path_thu),
            Some(tep_gia)
        );
        assert_eq!(
            tim_chuong_trinh_trong_path("khong_co_tep.exe", &path_thu),
            None
        );
        assert_eq!(
            tim_chuong_trinh_trong_path("C:\\Program Files\\Docker\\docker.exe", &path_thu),
            Some(PathBuf::from("C:\\Program Files\\Docker\\docker.exe"))
        );

        let _ = std::fs::remove_dir_all(&thu_muc_tam);
    }

    #[test]
    fn test_chuong_trinh_kiem_cong_cu_hop_le() {
        assert_eq!(
            chuong_trinh_kiem_cong_cu("npm"),
            Some(("npm.cmd", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("npx"),
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
        assert_eq!(
            chuong_trinh_kiem_cong_cu("cargo"),
            Some(("cargo.exe", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("conda"),
            Some(("conda.exe", vec!["--version"]))
        );
        assert_eq!(
            chuong_trinh_kiem_cong_cu("go"),
            Some(("go.exe", vec!["version"]))
        );
    }

    #[test]
    fn test_chuong_trinh_kiem_cong_cu_khong_ho_tro_va_chuoi_la() {
        assert_eq!(chuong_trinh_kiem_cong_cu("ruby"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("brew"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("cargo & dir"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("go; calc"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("npm; calc"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("pip & del C:\\"), None);
        assert_eq!(chuong_trinh_kiem_cong_cu(""), None);
        assert_eq!(chuong_trinh_kiem_cong_cu("winget --help"), None);
    }

    #[test]
    fn test_serialize_trang_thai_cong_cu() {
        assert_eq!(
            serde_json::to_string(&TrangThaiCongCu::SanSang).unwrap(),
            "\"SAN_SANG\""
        );
        assert_eq!(
            serde_json::to_string(&TrangThaiCongCu::ChuaCai).unwrap(),
            "\"CHUA_CAI\""
        );
        assert_eq!(
            serde_json::to_string(&TrangThaiCongCu::ChuaChay).unwrap(),
            "\"CHUA_CHAY\""
        );
        assert_eq!(
            serde_json::to_string(&TrangThaiCongCu::ThieuWsl).unwrap(),
            "\"THIEU_WSL\""
        );
    }

    #[test]
    fn test_duong_dan_docker_mac_dinh() {
        let duong_dan = duong_dan_docker_mac_dinh(Some(OsStr::new("C:\\Program Files")));
        assert_eq!(
            duong_dan,
            Some(
                PathBuf::from("C:\\Program Files")
                    .join("Docker")
                    .join("Docker")
                    .join("resources")
                    .join("bin")
                    .join("docker.exe")
            )
        );
        assert_eq!(duong_dan_docker_mac_dinh(None), None);
        assert_eq!(duong_dan_docker_mac_dinh(Some(OsStr::new(""))), None);
    }

    #[test]
    fn test_kiem_tra_trang_thai_cong_cu_khong_ho_tro_tra_none() {
        assert_eq!(kiem_tra_trang_thai_cong_cu("ruby"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu("brew"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu("cargo & dir"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu("go; calc"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu("docker; calc"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu("npm; calc"), None);
        assert_eq!(kiem_tra_trang_thai_cong_cu(""), None);
    }

    #[test]
    fn test_kiem_tra_trang_thai_cong_cu_hop_le_khong_panic() {
        // Kiểm tra hàm chạy an toàn với công cụ hỗ trợ mà không bị hoảng loạn (panic)
        let _ = kiem_tra_trang_thai_cong_cu("npm");
        let _ = kiem_tra_trang_thai_cong_cu("winget");
        let _ = kiem_tra_trang_thai_cong_cu("docker");
    }
}
