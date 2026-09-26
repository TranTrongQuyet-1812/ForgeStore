#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_CANCELLED};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOW;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct ThongTinUngDungRegistry {
    pub display_name: String,
    pub display_version: Option<String>,
    pub publisher: Option<String>,
    pub uninstall_string: Option<String>,
    pub install_location: Option<String>,
    pub registry_key: Option<String>,
}

/// Chuẩn hóa chuỗi để so khớp tên app (bỏ ký tự đặc biệt, chuyển về chữ thường)
pub fn chuan_hoa_ten(ten: &str) -> String {
    ten.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

/// Quét tất cả ứng dụng từ các khóa Uninstall trong Registry Windows (A4)
/// HKLM 64-bit, HKLM 32-bit (WOW6432Node), và HKCU
pub fn quet_tat_ca_ung_dung_registry() -> Vec<ThongTinUngDungRegistry> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;

        let mut danh_sach = Vec::new();
        let roots = vec![
            (
                RegKey::predef(HKEY_LOCAL_MACHINE),
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            ),
            (
                RegKey::predef(HKEY_LOCAL_MACHINE),
                "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            ),
            (
                RegKey::predef(HKEY_CURRENT_USER),
                "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            ),
        ];

        for (root, subkey_path) in roots {
            if let Ok(key) = root.open_subkey_with_flags(subkey_path, KEY_READ) {
                for subkey_name in key.enum_keys().map_while(Result::ok) {
                    if let Ok(sub) = key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                        let display_name: String = match sub.get_value("DisplayName") {
                            Ok(name) => name,
                            Err(_) => continue,
                        };
                        if display_name.trim().is_empty() {
                            continue;
                        }

                        // Bỏ qua component hệ thống
                        let is_system: u32 = sub.get_value("SystemComponent").unwrap_or(0);
                        if is_system == 1 {
                            continue;
                        }

                        let display_version: Option<String> = sub.get_value("DisplayVersion").ok();
                        let publisher: Option<String> = sub.get_value("Publisher").ok();
                        let uninstall_string: Option<String> = sub.get_value("UninstallString").ok();
                        let install_location: Option<String> = sub.get_value("InstallLocation").ok();

                        danh_sach.push(ThongTinUngDungRegistry {
                            display_name,
                            display_version,
                            publisher,
                            uninstall_string,
                            install_location,
                            registry_key: Some(subkey_name),
                        });
                    }
                }
            }
        }

        danh_sach
    }

    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

const TU_KHOA_CAM_FIRST_WORD: &[&str] = &[
    "microsoft", "windows", "google", "intel", "nvidia", "driver", "system", "android", "apple",
    "adobe",
];

/// Chụp snapshot các khóa registry gỡ cài đặt hiện có trên máy (HKLM, WOW6432, HKCU)
pub fn chup_snapshot_khoa_registry() -> std::collections::HashSet<String> {
    quet_tat_ca_ung_dung_registry()
        .into_iter()
        .filter_map(|app| app.registry_key)
        .collect()
}

/// Tìm khóa registry mới xuất hiện sau khi bộ cài đặt hoàn tất có liên quan đến ten_app (SEC-R4-03)
pub fn tim_khoa_registry_moi(
    snapshot_truoc: &std::collections::HashSet<String>,
    ten_app: &str,
) -> Option<ThongTinUngDungRegistry> {
    let danh_sach_sau = quet_tat_ca_ung_dung_registry();
    let bien_the = sinh_bien_the_ten_tim_kiem(ten_app);
    for app in danh_sach_sau {
        if let Some(ref k) = app.registry_key {
            if !snapshot_truoc.contains(k) && app.uninstall_string.is_some() {
                // Kiểm tra tên app mới có liên quan đến ten_app vừa cài đặt không
                let norm_disp = chuan_hoa_ten(&app.display_name);
                let norm_key = chuan_hoa_ten(k);
                let co_lien_quan = bien_the.iter().any(|b| {
                    norm_disp.contains(b) || norm_key.contains(b) || b.contains(&norm_disp)
                });
                if co_lien_quan {
                    return Some(app);
                }
            }
        }
    }
    None
}

/// Sinh các biến thể tên ứng dụng khả dĩ từ tên repo GitHub để dò tìm trong Registry
pub fn sinh_bien_the_ten_tim_kiem(ten_app: &str) -> Vec<String> {
    let ten_goc = if let Some(slash_idx) = ten_app.rfind('/') {
        &ten_app[slash_idx + 1..]
    } else {
        ten_app
    };

    let mut bien_the = Vec::new();

    // 1. Tên gốc đã chuẩn hóa
    let norm_goc = chuan_hoa_ten(ten_goc);
    if !norm_goc.is_empty() {
        bien_the.push(norm_goc);
    }

    // 2. Biến thể thay 'plus-plus' hoặc 'plusplus' thành '' hoặc 'plus' (Notepad++ -> notepad-plus-plus)
    let lower = ten_goc.to_lowercase();
    if lower.contains("plus-plus") || lower.contains("plusplus") {
        let b1 = lower.replace("plus-plus", "").replace("plusplus", "");
        let norm_b1 = chuan_hoa_ten(&b1);
        if norm_b1.len() >= 3 && !bien_the.contains(&norm_b1) {
            bien_the.push(norm_b1);
        }
    }

    // 3. Biến thể bỏ hậu tố thường gặp trên GitHub: -releases, _releases, -app, _app, -desktop, _desktop
    for suffix in &[
        "-releases", "_releases", "-release", "_release", "-app", "_app", "-desktop", "_desktop",
        "-client", "_client",
    ] {
        if lower.ends_with(suffix) {
            let trimmed = &lower[..lower.len() - suffix.len()];
            let norm_trimmed = chuan_hoa_ten(trimmed);
            if norm_trimmed.len() >= 3 && !bien_the.contains(&norm_trimmed) {
                bien_the.push(norm_trimmed);
            }
        }
    }

    // 4. Lấy từ đầu tiên nếu tên có dấu '-' hoặc '_' (ví dụ: notepad-plus-plus -> notepad, transmission-remote -> transmission)
    // SEC-R4-01: Chặn các từ khóa chung/hệ điều hành trong TU_KHOA_CAM_FIRST_WORD để tránh match nhầm phần mềm hệ thống
    if let Some(first_word) = lower.split(&['-', '_'][..]).next() {
        let norm_first = chuan_hoa_ten(first_word);
        if norm_first.len() >= 4
            && !TU_KHOA_CAM_FIRST_WORD.contains(&norm_first.as_str())
            && !bien_the.contains(&norm_first)
        {
            bien_the.push(norm_first);
        }
    }

    bien_the
}

/// Tìm ứng dụng trong danh sách đã quét theo tên app hoặc repo handle
pub fn tim_ung_dung_trong_danh_sach(
    danh_sach: &[ThongTinUngDungRegistry],
    ten_app: &str,
) -> Option<ThongTinUngDungRegistry> {
    let cac_bien_the = sinh_bien_the_ten_tim_kiem(ten_app);
    if cac_bien_the.is_empty() {
        return None;
    }

    // Ưu tiên 1: Khớp chính xác hoàn toàn (exact match) với bất kỳ biến thể nào
    for candidate in &cac_bien_the {
        for app in danh_sach {
            let norm_display = chuan_hoa_ten(&app.display_name);
            if norm_display == *candidate && app.uninstall_string.is_some() {
                return Some(app.clone());
            }
        }
    }

    // Ưu tiên 2: Khớp tiền tố (starts_with) với ứng viên (độ dài >= 3)
    for candidate in &cac_bien_the {
        if candidate.len() < 3 {
            continue;
        }
        for app in danh_sach {
            let norm_display = chuan_hoa_ten(&app.display_name);
            if norm_display.starts_with(candidate) && app.uninstall_string.is_some() {
                return Some(app.clone());
            }
        }
    }

    // Ưu tiên 3: Khớp chứa (contains) nhưng bắt buộc candidate >= 4 ký tự để tránh match nhầm
    for candidate in &cac_bien_the {
        if candidate.len() < 4 {
            continue;
        }
        for app in danh_sach {
            let norm_display = chuan_hoa_ten(&app.display_name);
            if norm_display.contains(candidate) && app.uninstall_string.is_some() {
                return Some(app.clone());
            }
        }
    }

    None
}

/// Tìm ứng dụng trong registry theo tên app hoặc repo handle (A4)
pub fn tim_ung_dung_trong_registry(ten_app: &str) -> Option<ThongTinUngDungRegistry> {
    let danh_sach = quet_tat_ca_ung_dung_registry();
    if danh_sach.is_empty() {
        return None;
    }

    tim_ung_dung_trong_danh_sach(&danh_sach, ten_app)
}

/// Tìm ứng dụng trong registry theo khóa cụ thể HOẶC display_name HOẶC tên app
pub fn tim_ung_dung_chinh_xac_registry(
    ten_app: &str,
    registry_key: Option<&str>,
    display_name: Option<&str>,
) -> Option<ThongTinUngDungRegistry> {
    let danh_sach = quet_tat_ca_ung_dung_registry();
    if danh_sach.is_empty() {
        return None;
    }

    // 1. Ưu tiên cao nhất: Tìm theo registry_key đã lưu từ snapshot khi cài đặt
    if let Some(key) = registry_key {
        let trimmed_key = key.trim();
        if !trimmed_key.is_empty() {
            for app in &danh_sach {
                if let Some(ref k) = app.registry_key {
                    if k.eq_ignore_ascii_case(trimmed_key) && app.uninstall_string.is_some() {
                        return Some(app.clone());
                    }
                }
            }
        }
    }

    // 2. Ưu tiên nhì: Tìm theo display_name đã lưu từ registry thật
    if let Some(disp) = display_name {
        let norm_disp = chuan_hoa_ten(disp);
        if !norm_disp.is_empty() {
            for app in &danh_sach {
                if chuan_hoa_ten(&app.display_name) == norm_disp && app.uninstall_string.is_some() {
                    return Some(app.clone());
                }
            }
        }
    }

    // 3. Dự phòng: Tìm theo tên app / tên repo với các biến thể
    tim_ung_dung_trong_danh_sach(&danh_sach, ten_app)
}

/// Bóc tách chuỗi UninstallString thành (Đường dẫn tệp thực thi, Đối số tham số)
pub fn phan_tich_uninstall_string(raw: &str) -> (String, String) {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return (String::new(), String::new());
    }

    // Trường hợp 1: Bắt đầu bằng dấu ngoặc kép "C:\Path\To\uninstall.exe" ...
    if trimmed.starts_with('"') {
        if let Some(second_quote_idx) = trimmed[1..].find('"') {
            let exe = &trimmed[1..=second_quote_idx];
            let args = trimmed[second_quote_idx + 2..].trim();
            return (exe.to_string(), args.to_string());
        }
    }

    // Trường hợp 2: Lệnh msiexec /I{...} hoặc MsiExec.exe /X{...}
    let lower = trimmed.to_lowercase();
    if lower.starts_with("msiexec.exe") || lower.starts_with("msiexec ") {
        let rest = if lower.starts_with("msiexec.exe") {
            trimmed[11..].trim()
        } else {
            trimmed[7..].trim()
        };
        // Nếu tham số là /I hoặc /i (cài đặt), đổi thành /X (gỡ bỏ)
        let args = if rest.starts_with("/I") || rest.starts_with("/i") {
            format!("/X{}", &rest[2..])
        } else {
            rest.to_string()
        };
        return ("msiexec.exe".to_string(), args);
    }

    // Trường hợp 3: Đường dẫn không có dấu nháy kép nhưng có khoảng trắng
    // Kiểm tra vị trí cuối cùng kết thúc bằng .exe (SEC-05: dùng rfind để tránh lỗi thư mục chứa cụm .exe)
    if let Some(exe_idx) = lower.rfind(".exe") {
        let exe_end = exe_idx + 4;
        let exe = trimmed[..exe_end].trim();
        let args = trimmed[exe_end..].trim();
        return (exe.to_string(), args.to_string());
    }

    // Mặc định
    (trimmed.to_string(), String::new())
}

/// Chạy bộ gỡ cài đặt chính chủ của phần mềm qua ShellExecuteExW xin quyền Admin (A4, SEC-06)
pub fn chay_go_cai_dat_registry(uninstall_string: &str) -> Result<bool, String> {
    let (exe_path, args) = phan_tich_uninstall_string(uninstall_string);
    if exe_path.is_empty() {
        return Err("Chuỗi UninstallString không hợp lệ hoặc rỗng.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let exe_wide: Vec<u16> = OsStr::new(&exe_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let args_wide: Option<Vec<u16>> = if !args.is_empty() {
            Some(
                OsStr::new(&args)
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect(),
            )
        } else {
            None
        };

        // SEC-V3-06: Trích xuất thư mục cha làm lpDirectory để phòng chống DLL Hijacking
        let work_dir_wide: Option<Vec<u16>> = std::path::Path::new(&exe_path)
            .parent()
            .and_then(|p| if p.as_os_str().is_empty() { None } else { Some(p) })
            .map(|p| {
                p.as_os_str()
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect()
            });

        // SEC-06: Sử dụng verb "runas" để luôn yêu cầu quyền Quản trị viên (UAC) rõ ràng
        let verb_wide: Vec<u16> = OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut sei: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        sei.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.fMask = SEE_MASK_NOCLOSEPROCESS;
        sei.lpVerb = verb_wide.as_ptr();
        sei.lpFile = exe_wide.as_ptr();
        if let Some(ref a) = args_wide {
            sei.lpParameters = a.as_ptr();
        }
        if let Some(ref d) = work_dir_wide {
            sei.lpDirectory = d.as_ptr();
        }
        sei.nShow = SW_SHOW as i32;

        let success = unsafe { ShellExecuteExW(&mut sei) };
        if success == 0 {
            let err_code = unsafe { GetLastError() };
            if err_code == ERROR_CANCELLED {
                return Err("NGUOI_DUNG_HUY: Người dùng đã từ chối cấp quyền Quản trị viên (UAC) khi gỡ cài đặt.".to_string());
            }
            return Err(format!(
                "Không thể khởi chạy bộ gỡ cài đặt qua ShellExecuteExW (mã lỗi Win32: {}).",
                err_code
            ));
        }

        let h_process = sei.hProcess;
        if !h_process.is_null() {
            unsafe {
                // FE-V3-01: Đặt timeout tối đa 10 phút (600.000 ms), tránh khóa luồng vĩnh viễn nếu uninstaller bị treo
                const TIMEOUT_MS: u32 = 10 * 60 * 1000;
                const WAIT_TIMEOUT_VAL: u32 = 258; // WAIT_TIMEOUT Win32 code

                let wait_res = WaitForSingleObject(h_process, TIMEOUT_MS);
                if wait_res == WAIT_TIMEOUT_VAL {
                    CloseHandle(h_process);
                    return Err("TIEN_TRINH_TREO: Bộ gỡ cài đặt đã vượt quá thời gian chờ (10 phút).".to_string());
                }

                let mut exit_code: u32 = 0;
                GetExitCodeProcess(h_process, &mut exit_code);
                CloseHandle(h_process);

                if exit_code == 0 {
                    Ok(true)
                } else if exit_code == 1602 {
                    Err("NGUOI_DUNG_HUY: Người dùng đã hủy tiến trình gỡ cài đặt.".to_string())
                } else {
                    Err(format!(
                        "Bộ gỡ cài đặt kết thúc với mã thoát không thành công: {}.",
                        exit_code
                    ))
                }
            }
        } else {
            Ok(true)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(true)
    }
}

/// Xác thực chuỗi uninstall_string hoặc registry_key với Registry thực tế và chạy gỡ cài đặt an toàn (SEC-01)
pub fn chay_go_cai_dat_registry_an_toan(
    ten_app: &str,
    uninstall_string: Option<&str>,
    registry_key: Option<&str>,
) -> Result<bool, String> {
    let tat_ca_ung_dung = quet_tat_ca_ung_dung_registry();

    let mut chuoi_hop_le: Option<String> = None;
    let norm_app = chuan_hoa_ten(ten_app);

    // 1. Ưu tiên cao nhất: Tìm chính xác theo registry_key đã xác định
    if let Some(key) = registry_key {
        let trimmed_key = key.trim();
        if !trimmed_key.is_empty() {
            for app in &tat_ca_ung_dung {
                if let Some(ref k) = app.registry_key {
                    if k.eq_ignore_ascii_case(trimmed_key) {
                        if let Some(ref reg_str) = app.uninstall_string {
                            chuoi_hop_le = Some(reg_str.clone());
                            break;
                        }
                    }
                }
            }
        }
    }

    // 2. Nếu không tìm thấy qua registry_key (hoặc không truyền), kiểm tra client_str có trong Registry thật không
    // và bắt buộc ứng dụng trong Registry phải khớp tên app (SEC-VULN-02 & SEC-V3-03)
    if chuoi_hop_le.is_none() {
        if let Some(client_str) = uninstall_string {
            let client_trimmed = client_str.trim();
            if !client_trimmed.is_empty() {
                for app in &tat_ca_ung_dung {
                    if let Some(ref reg_str) = app.uninstall_string {
                        if reg_str.trim().eq_ignore_ascii_case(client_trimmed) {
                            let norm_disp = chuan_hoa_ten(&app.display_name);
                            // SEC-V3-03: Chỉ chấp nhận nếu display_name trùng khớp hoặc chứa tên app (khi display_name dài hơn)
                            // Tuyệt đối KHÔNG dùng match nghịch norm_app.contains(&norm_disp) để chống IPC spoofing
                            if norm_disp == norm_app
                                || (norm_app.len() >= 3 && norm_disp.contains(&norm_app))
                            {
                                chuoi_hop_le = Some(reg_str.clone());
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. TUYỆT ĐỐI BỎ HẲN BƯỚC DÒ MỜ fallback tim_ung_dung_trong_registry(ten_app) ở đường gỡ!
    // Tránh tình trạng "Hiện một đằng, gỡ một nẻo" (ví dụ: gỡ Notepad++ nhưng rơi xuống dò mờ match sang Notepad3)
    let final_uninstall_string = match chuoi_hop_le {
        Some(s) => s,
        None => {
            return Err(format!(
                "CẢNH BÁO BẢO MẬT: Lệnh gỡ cài đặt cho '{}' không tồn tại trong Windows Registry hoặc không khớp khóa đã xác thực. Thao tác bị từ chối!",
                ten_app
            ));
        }
    };

    chay_go_cai_dat_registry(&final_uninstall_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chuan_hoa_ten() {
        assert_eq!(chuan_hoa_ten("Notepad++ (64-bit)"), "notepad64bit");
        assert_eq!(chuan_hoa_ten("RustDesk - Remote"), "rustdeskremote");
        assert_eq!(chuan_hoa_ten("microsoft/PowerToys"), "microsoftpowertoys");
    }

    #[test]
    fn test_phan_tich_uninstall_string_co_nhay() {
        let raw = "\"C:\\Program Files\\Notepad++\\uninstall.exe\" /S";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "C:\\Program Files\\Notepad++\\uninstall.exe");
        assert_eq!(args, "/S");
    }

    #[test]
    fn test_phan_tich_uninstall_string_msiexec() {
        let raw = "MsiExec.exe /I{12345-ABCD-6789}";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "msiexec.exe");
        assert_eq!(args, "/X{12345-ABCD-6789}");
    }

    #[test]
    fn test_phan_tich_uninstall_string_khong_nhay() {
        let raw = "C:\\Tools\\unins000.exe /silent";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "C:\\Tools\\unins000.exe");
        assert_eq!(args, "/silent");
    }

    #[test]
    fn test_phan_tich_uninstall_string_folder_co_chu_exe() {
        // SEC-05: Thư mục chứa cụm .exe không bị cắt sai
        let raw = "C:\\Tools\\My.exe.Folder\\unins000.exe /silent /norestart";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "C:\\Tools\\My.exe.Folder\\unins000.exe");
        assert_eq!(args, "/silent /norestart");
    }

    #[test]
    fn test_chay_go_cai_dat_rong() {
        let res = chay_go_cai_dat_registry("");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không hợp lệ hoặc rỗng"));
    }
}
