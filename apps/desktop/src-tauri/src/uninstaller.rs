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
    pub display_icon: Option<String>,
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
                        let mut display_icon: Option<String> = sub.get_value("DisplayIcon").ok();

                        // R-08: Nếu display_icon rỗng hoặc không phải file exe hợp lệ (ví dụ msiexec.exe,0 hoặc uninstaller),
                        // kiểm tra xem trong install_location hoặc install_location\bin có file thực thi hợp lệ không
                        let icon_hop_le = display_icon
                            .as_ref()
                            .and_then(|icon| trich_xuat_exe_tu_display_icon(icon))
                            .is_some();

                        if !icon_hop_le {
                            if let Some(ref loc) = install_location {
                                let loc_path = std::path::Path::new(loc.trim().trim_matches('"'));
                                if let Some(exe) = tim_tep_thuc_thi_trong_thu_muc_cai_dat(loc_path, Some(&display_name)) {
                                    display_icon = Some(exe.to_string_lossy().to_string());
                                }
                            }
                        }

                        danh_sach.push(ThongTinUngDungRegistry {
                            display_name,
                            display_version,
                            publisher,
                            uninstall_string,
                            install_location,
                            registry_key: Some(subkey_name),
                            display_icon,
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

    let (mut exe, mut args) = if trimmed.starts_with('"') {
        if let Some(second_quote_idx) = trimmed[1..].find('"') {
            let e = &trimmed[1..=second_quote_idx];
            let a = trimmed[second_quote_idx + 2..].trim();
            (e.to_string(), a.to_string())
        } else {
            (trimmed.to_string(), String::new())
        }
    } else {
        let lower = trimmed.to_lowercase();
        if lower.starts_with("msiexec.exe") || lower.starts_with("msiexec ") {
            let rest = if lower.starts_with("msiexec.exe") {
                trimmed[11..].trim()
            } else {
                trimmed[7..].trim()
            };
            ("msiexec.exe".to_string(), rest.to_string())
        } else if let Some(exe_idx) = lower.rfind(".exe") {
            let exe_end = exe_idx + 4;
            (
                trimmed[..exe_end].trim().to_string(),
                trimmed[exe_end..].trim().to_string(),
            )
        } else {
            (trimmed.to_string(), String::new())
        }
    };

    // SEC-R7-05, DELIV-44.2 & SEC-R8-02: Chuẩn hóa cờ MSI /i -> /X cho TẤT CẢ các trường hợp gọi msiexec
    // (kể cả có nháy kép "msiexec.exe", hoặc đường dẫn đầy đủ "C:\Windows\System32\msiexec.exe")
    let exe_file_name = std::path::Path::new(&exe)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("")
        .to_lowercase();

    if exe_file_name == "msiexec.exe" || exe_file_name == "msiexec" {
        exe = "msiexec.exe".to_string();
        if args.starts_with("/I") || args.starts_with("/i") {
            let next_char = args.chars().nth(2);
            if next_char.map_or(true, |c| c == '{' || c == ' ' || c == '"' || c == '\t') {
                args = format!("/X{}", &args[2..]);
            }
        } else if let Some(idx) = args.to_lowercase().find(" /i") {
            let next_char = args.chars().nth(idx + 3);
            if next_char.map_or(true, |c| c == '{' || c == ' ' || c == '"' || c == '\t') {
                args = format!("{} /X{}", &args[..idx], &args[idx + 3..]);
            }
        }
    }

    (exe, args)
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

        // SEC-V3-06 & SEC-R6-06: Trích xuất thư mục cha làm lpDirectory để phòng chống DLL Hijacking.
        // Đối với msiexec.exe hoặc file không có parent path, gán tường minh C:\Windows\System32
        let default_sys32 = std::path::Path::new("C:\\Windows\\System32");
        let work_dir_path = std::path::Path::new(&exe_path)
            .parent()
            .and_then(|p| if p.as_os_str().is_empty() { None } else { Some(p) })
            .unwrap_or(default_sys32);

        let work_dir_wide: Vec<u16> = work_dir_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

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
        sei.lpDirectory = work_dir_wide.as_ptr();
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

/// Kiểm tra xem tên app hoặc repo handle có khớp với display_name hoặc registry_key của phần mềm không (DELIV-44.2)
/// Sử dụng các biến thể từ `sinh_bien_the_ten_tim_kiem` để đảm bảo "Hiện ra được thì gỡ được"
pub fn kiem_tra_ten_app_khop_registry(
    ten_app: &str,
    display_name: &str,
    registry_key: Option<&str>,
) -> bool {
    let cac_bien_the = sinh_bien_the_ten_tim_kiem(ten_app);
    let norm_disp = chuan_hoa_ten(display_name);
    let norm_k = registry_key.map(chuan_hoa_ten).unwrap_or_default();

    cac_bien_the.iter().any(|b| {
        if b.len() < 3 {
            return false;
        }
        // Khớp hoàn toàn cho phép từ 3 ký tự (git, vlc...)
        let exact_match = norm_disp == *b || (!norm_k.is_empty() && norm_k == *b);
        if exact_match {
            return true;
        }
        // SEC-R8-04: Khớp chứa (contains) BẮT BUỘC >= 4 ký tự để tránh match nhầm từ khóa ngắn vào phần mềm hệ thống
        if b.len() >= 4 {
            return norm_disp.contains(b) || (!norm_k.is_empty() && norm_k.contains(b));
        }
        false
    })
}

/// Xác thực chuỗi uninstall_string hoặc registry_key với Registry thực tế và chạy gỡ cài đặt an toàn (SEC-01)
pub fn chay_go_cai_dat_registry_an_toan(
    ten_app: &str,
    uninstall_string: Option<&str>,
    registry_key: Option<&str>,
) -> Result<bool, String> {
    let tat_ca_ung_dung = quet_tat_ca_ung_dung_registry();

    let mut chuoi_hop_le: Option<String> = None;

    // 1. Ưu tiên cao nhất: Tìm chính xác theo registry_key đã xác định
    if let Some(key) = registry_key {
        let trimmed_key = key.trim();
        if !trimmed_key.is_empty() {
            for app in &tat_ca_ung_dung {
                if let Some(ref k) = app.registry_key {
                    if k.eq_ignore_ascii_case(trimmed_key) {
                        // SEC-R6-02, SEC-R7-03 & DELIV-44.2: Đối soát tên ten_app bằng các biến thể từ sinh_bien_the_ten_tim_kiem
                        // Đảm bảo "Hiện ra được thì gỡ được" (Notepad++, Obsidian, Termux...) mà vẫn ngăn chặn IPC spoofing
                        if kiem_tra_ten_app_khop_registry(ten_app, &app.display_name, Some(k)) {
                            if let Some(ref reg_str) = app.uninstall_string {
                                chuoi_hop_le = Some(reg_str.clone());
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Nếu không tìm thấy qua registry_key (hoặc không truyền), kiểm tra client_str có trong Registry thật không
    // và bắt buộc ứng dụng trong Registry phải khớp tên app (SEC-VULN-02 & DELIV-44.2)
    if chuoi_hop_le.is_none() {
        if let Some(client_str) = uninstall_string {
            let client_trimmed = client_str.trim();
            if !client_trimmed.is_empty() {
                for app in &tat_ca_ung_dung {
                    if let Some(ref reg_str) = app.uninstall_string {
                        if reg_str.trim().eq_ignore_ascii_case(client_trimmed) {
                            if kiem_tra_ten_app_khop_registry(
                                ten_app,
                                &app.display_name,
                                app.registry_key.as_deref(),
                            ) {
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

/// Kiểm tra xem đường dẫn có nằm dưới thư mục Windows hay không (R-06)
/// Đọc linh hoạt từ biến môi trường %SystemRoot% / %windir% hoặc mặc định C:\Windows
pub fn la_thu_muc_windows(path_str: &str) -> bool {
    // R-09: Bỏ tiền tố \\?\ hoặc \??\ trước khi so, nếu không `\\?\C:\Windows\...` sẽ lọt qua bộ lọc
    let trimmed = path_str.trim();
    let no_prefix = trimmed
        .strip_prefix(r"\\?\")
        .or_else(|| trimmed.strip_prefix(r"\??\"))
        .unwrap_or(trimmed);
    let lower = no_prefix.to_ascii_lowercase().replace('/', "\\");
    if lower.starts_with(r"c:\windows\") || lower == r"c:\windows" {
        return true;
    }
    if let Ok(windir) = std::env::var("windir") {
        let win_lower = windir.to_ascii_lowercase().replace('/', "\\");
        let prefix = if win_lower.ends_with('\\') { win_lower } else { format!("{}\\", win_lower) };
        if lower.starts_with(&prefix) || lower == prefix.trim_end_matches('\\') {
            return true;
        }
    }
    if let Ok(sysroot) = std::env::var("SystemRoot") {
        let sys_lower = sysroot.to_ascii_lowercase().replace('/', "\\");
        let prefix = if sys_lower.ends_with('\\') { sys_lower } else { format!("{}\\", sys_lower) };
        if lower.starts_with(&prefix) || lower == prefix.trim_end_matches('\\') {
            return true;
        }
    }
    false
}

/// Kiểm tra thư mục cài đặt có an toàn và hợp lệ hay không (R-06, SEC-R9-02, SEC-R9-03)
/// - Cấm đường dẫn mạng UNC (\\ hoặc //) chống rò rỉ băm NetNTLMv2
/// - Cấm mọi thư mục nằm dưới thư mục Windows (%SystemRoot%, %windir%, C:\Windows)
/// - Cấm thư mục ProgramData\Package Cache của các bộ cài đặt (kể cả 8.3 short name packag~1)
/// - Cấm các thư mục temp, system32, syswow64 theo đúng path segment (không chặn nhầm Tempest, xử lý trailing dot)
/// - Cấm thư mục gốc như C:\ hoặc C:
pub fn la_thu_muc_cai_dat_hop_le(path: &std::path::Path) -> bool {
    let s = path.to_string_lossy();
    let trimmed = s.trim().trim_matches('"').trim();

    if trimmed.is_empty() {
        return false;
    }

    // SEC-R9-03: Chặn đứng đường dẫn mạng UNC và NT Device Path chống rò rỉ NetNTLM hash qua SMB
    if trimmed.starts_with(r"\\")
        || trimmed.starts_with("//")
        || trimmed.starts_with(r"\??\")
        || trimmed.starts_with(r"\\?\")
    {
        return false;
    }

    // SEC-R9-02: Chuẩn hóa canonicalize nếu thư mục tồn tại để giải quyết symlink, relative traversal (..) và 8.3 short name
    if let Ok(canon) = path.canonicalize() {
        // Cấm ổ đĩa gốc (không có parent)
        if canon.parent().is_none() {
            return false;
        }

        // Chặn nếu nằm dưới thư mục Windows
        if let Ok(windir) = std::env::var("WINDIR") {
            if let Ok(canon_win) = std::path::PathBuf::from(windir).canonicalize() {
                if canon.starts_with(&canon_win) {
                    return false;
                }
            }
        }
        if let Ok(sysroot) = std::env::var("SystemRoot") {
            if let Ok(canon_sys) = std::path::PathBuf::from(sysroot).canonicalize() {
                if canon.starts_with(&canon_sys) {
                    return false;
                }
            }
        }

        // Chặn nếu nằm dưới ProgramData\Package Cache
        if let Ok(progdata) = std::env::var("ProgramData") {
            let pkg_cache = std::path::PathBuf::from(progdata).join("Package Cache");
            if let Ok(canon_pkg) = pkg_cache.canonicalize() {
                if canon.starts_with(&canon_pkg) {
                    return false;
                }
            }
        }
    }

    let normalized = trimmed.replace('/', "\\");

    // 1. Chặn thư mục nằm dưới thư mục Windows
    if la_thu_muc_windows(&normalized) {
        return false;
    }

    // 2. Chặn Package Cache của Windows Installer / Visual Studio / burn engine (kể cả 8.3 SFN packag~1)
    let lower = normalized.to_ascii_lowercase();
    if lower.contains(r"programdata\package cache")
        || lower.contains(r"package cache")
        || lower.contains("packag~1")
    {
        return false;
    }

    // 3. Chặn thư mục Temp, System32, SysWOW64 theo đúng từng phân đoạn đường dẫn (không chặn nhầm Tempest, loại bỏ trailing dot)
    for part in lower.split('\\') {
        let p_clean = part.trim().trim_end_matches('.');
        if p_clean == "temp" || p_clean == "tmp" || p_clean == "system32" || p_clean == "syswow64" {
            return false;
        }
    }

    // 4. Không được chỉ là ổ đĩa gốc như C:\ hoặc C:
    if (lower.len() <= 3 && lower.contains(':')) || lower == "\\" {
        return false;
    }

    true
}

/// Tìm file thực thi chính của ứng dụng trong InstallLocation hoặc InstallLocation\bin (R-08, SEC-R9-01, SEC-R9-04)
pub fn tim_tep_thuc_thi_trong_thu_muc_cai_dat(
    install_loc: &std::path::Path,
    ten_app: Option<&str>,
) -> Option<std::path::PathBuf> {
    if !install_loc.is_dir() || !la_thu_muc_cai_dat_hop_le(install_loc) {
        return None;
    }

    // SEC-R9-01: Canonicalize thư mục gốc cài đặt để làm mốc kiểm tra bao bọc (enclosure boundary)
    let canon_install_loc = match install_loc.canonicalize() {
        Ok(c) => c,
        Err(_) => return None,
    };

    let search_dirs = [canon_install_loc.clone(), canon_install_loc.join("bin")];
    let app_clean = ten_app.map(chuan_hoa_ten).unwrap_or_default();

    for dir in &search_dirs {
        if !dir.is_dir() {
            continue;
        }

        // 1. SEC-R9-01: Khử khuẩn ten_app chống Path Traversal (cấm / \ .. và chỉ lấy file_name)
        if let Some(app_name) = ten_app {
            let trimmed = app_name.trim();
            if !trimmed.contains('/') && !trimmed.contains('\\') && !trimmed.contains("..") {
                let safe_stem = std::path::Path::new(trimmed)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("");
                if !safe_stem.is_empty() {
                    let direct = dir.join(format!("{}.exe", safe_stem));
                    if direct.is_file() {
                        if let Ok(canon_direct) = direct.canonicalize() {
                            if canon_direct.starts_with(&canon_install_loc)
                                && la_tep_thuc_thi_app_hop_le(&canon_direct)
                            {
                                return Some(canon_direct);
                            }
                        }
                    }
                }
            }
        }

        // 2. Duyệt các file .exe trong thư mục tìm file khớp tên hoặc file duy nhất
        if let Ok(entries) = std::fs::read_dir(dir) {
            let mut valid_exes = Vec::new();

            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && la_tep_thuc_thi_app_hop_le(&p) {
                    let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or_default();
                    let norm_stem = chuan_hoa_ten(file_stem);

                    // SEC-R9-04: Siết chặt so khớp: chuỗi ngắn < 4 ký tự phải khớp chính xác tuyệt đối
                    if !app_clean.is_empty() {
                        let is_match = if norm_stem == app_clean {
                            true
                        } else if norm_stem.len() >= 4 && app_clean.len() >= 4 {
                            norm_stem.contains(&app_clean) || app_clean.contains(&norm_stem)
                        } else {
                            false
                        };

                        if is_match {
                            if let Ok(canon_p) = p.canonicalize() {
                                if canon_p.starts_with(&canon_install_loc) {
                                    return Some(canon_p);
                                }
                            }
                        }
                    }

                    valid_exes.push(p);
                }
            }

            // Nếu trong thư mục con bin/ chỉ có đúng 1 file .exe hợp lệ, chọn file đó
            if dir.file_name().and_then(|f| f.to_str()) == Some("bin") && valid_exes.len() == 1 {
                let bin_exe = valid_exes.remove(0);
                if let Ok(canon_bin) = bin_exe.canonicalize() {
                    if canon_bin.starts_with(&canon_install_loc) {
                        return Some(canon_bin);
                    }
                }
            }
        }
    }

    None
}

/// Kiểm tra tệp thực thi có phải là ứng dụng hợp lệ hay không (R-01, R-06)
/// Loại bỏ các file có tên chứa unins, uninst, uninstall, setup, install, update, msiexec,
/// và mọi file nằm dưới C:\Windows\ hoặc Package Cache để tránh chạy nhầm bộ gỡ hoặc bộ cài đặt.
pub fn la_tep_thuc_thi_app_hop_le(path: &std::path::Path) -> bool {
    let path_str = path.to_string_lossy().to_ascii_lowercase();
    // Chặn mọi file nằm dưới thư mục Windows (R-06)
    if la_thu_muc_windows(&path_str) {
        return false;
    }

    // Chặn file trong Package Cache
    if path_str.contains(r"programdata\package cache") || path_str.contains(r"package cache") {
        return false;
    }

    if let Some(file_name) = path.file_name() {
        let name_lower = file_name.to_string_lossy().to_ascii_lowercase();
        let tu_khoa_cam = [
            "unins", "uninst", "uninstall", "setup", "install", "update", "msiexec",
        ];
        for kw in tu_khoa_cam {
            if name_lower.contains(kw) {
                return false;
            }
        }
        true
    } else {
        false
    }
}

/// Trích xuất đường dẫn file thực thi .exe từ chuỗi DisplayIcon trong Windows Registry (L-01, R-01)
/// Hỗ trợ các định dạng thực tế:
/// - "C:\Program Files\Notepad++\notepad++.exe,0"
/// - "C:\Program Files\Notepad++\notepad++.exe",0
/// - C:\Program Files\DBeaver\dbeaver.exe
/// - C:\Users\...\Obsidian.exe
/// R-01: Tự động loại bỏ uninstaller, setup, update, msiexec và C:\Windows\
pub fn trich_xuat_exe_tu_display_icon(display_icon_str: &str) -> Option<std::path::PathBuf> {
    let trimmed = display_icon_str.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Bỏ tiền tố \\?\ hoặc \??\ nếu có
    let no_prefix = if let Some(stripped) = trimmed.strip_prefix(r"\\?\") {
        stripped
    } else if let Some(stripped) = trimmed.strip_prefix(r"\??\") {
        stripped
    } else {
        trimmed
    };

    // Chuẩn hóa: nếu toàn bộ chuỗi được bọc trong cặp nháy kép `"..."`, bỏ cặp nháy ngoài cùng trước
    let unquoted = if no_prefix.starts_with('"') && no_prefix.ends_with('"') && no_prefix.len() >= 2 {
        &no_prefix[1..no_prefix.len() - 1]
    } else {
        no_prefix
    };

    // Tách bỏ chỉ số icon sau dấu phẩy (ví dụ: ,0 hoặc ,-101 hoặc ",0)
    let candidate = if let Some(last_comma) = unquoted.rfind(',') {
        let after_comma = unquoted[last_comma + 1..].trim().trim_matches('"').trim();
        if after_comma.parse::<i32>().is_ok() {
            &unquoted[..last_comma]
        } else {
            unquoted
        }
    } else {
        unquoted
    };

    let clean_path = candidate.trim().trim_matches('"').trim();
    if clean_path.is_empty() {
        return None;
    }

    let path = std::path::PathBuf::from(clean_path);
    // Bắt buộc phần mở rộng là .exe và phải là tệp thực thi hợp lệ (R-01)
    if let Some(ext) = path.extension() {
        if ext.to_string_lossy().eq_ignore_ascii_case("exe") && la_tep_thuc_thi_app_hop_le(&path) {
            return Some(path);
        }
    }

    None
}

/// Mở ứng dụng đã cài đặt trên máy bằng cách đọc Registry (L-01, R-08)
/// Tuyệt đối an toàn: Native Rust tự tra cứu Registry đã được Windows xác thực,
/// trích xuất file .exe từ DisplayIcon, kiểm tra tồn tại và khởi chạy.
pub fn mo_ung_dung_tu_registry(khoa_registry: &str, ten_app: Option<&str>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;
        use std::process::Command;
        use std::path::{Path, PathBuf};

        let clean_key = khoa_registry.trim();
        if clean_key.is_empty() {
            return Err("Khóa registry không được để trống".to_string());
        }

        let roots = vec![
            (
                RegKey::predef(HKEY_LOCAL_MACHINE),
                format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{}", clean_key),
            ),
            (
                RegKey::predef(HKEY_LOCAL_MACHINE),
                format!("SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{}", clean_key),
            ),
            (
                RegKey::predef(HKEY_CURRENT_USER),
                format!("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{}", clean_key),
            ),
        ];

        let mut exe_path_opt: Option<PathBuf> = None;

        for (root, subkey_path) in roots {
            if let Ok(sub) = root.open_subkey_with_flags(&subkey_path, KEY_READ) {
                // 1. Thử lấy từ DisplayIcon
                if let Ok(display_icon) = sub.get_value::<String, _>("DisplayIcon") {
                    if let Some(exe) = trich_xuat_exe_tu_display_icon(&display_icon) {
                        if exe.is_file() {
                            exe_path_opt = Some(exe);
                            break;
                        }
                    }
                }

                // 2. Thử lấy từ InstallLocation (R-08: tìm cả trong bin\)
                if let Ok(install_loc) = sub.get_value::<String, _>("InstallLocation") {
                    let loc_path = Path::new(install_loc.trim().trim_matches('"'));
                    if let Some(exe) = tim_tep_thuc_thi_trong_thu_muc_cai_dat(loc_path, ten_app) {
                        exe_path_opt = Some(exe);
                        break;
                    }
                }
            }
        }

        // R-01: Bỏ bước dò mờ theo tên (tim_ung_dung_chinh_xac_registry với ten_app), chỉ dùng đúng khoa_registry.

        let exe_path = match exe_path_opt {
            Some(p) => p,
            None => {
                return Err(format!(
                    "Không tìm thấy tệp thực thi .exe hợp lệ từ thông tin cài đặt của ứng dụng (khóa: '{}'). Bạn hãy mở trực tiếp từ Start Menu.",
                    clean_key
                ));
            }
        };

        // Chặn đường dẫn mạng UNC chống rò rỉ NTLM
        let exe_str = exe_path.to_string_lossy();
        if exe_str.starts_with(r"\\") || exe_str.starts_with("//") {
            return Err("Từ chối khởi chạy tệp thực thi từ đường dẫn mạng UNC.".to_string());
        }

        let parent_dir = exe_path.parent().unwrap_or_else(|| Path::new(r"C:\Windows\System32"));

        Command::new(&exe_path)
            .current_dir(parent_dir)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy ứng dụng '{}': {}", exe_path.display(), e))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = khoa_registry;
        let _ = ten_app;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

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
    fn test_phan_tich_uninstall_string_msiexec_co_co_quiet() {
        let raw = "msiexec.exe /quiet /I{12345-ABCD-6789}";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "msiexec.exe");
        assert_eq!(args, "/quiet /X{12345-ABCD-6789}");
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

    #[test]
    fn test_chay_go_cai_dat_registry_an_toan_khoa_sai_tu_choi() {
        // DELIV-39.2: Khóa registry không tồn tại trong Windows Registry hoặc không hợp lệ
        // Phải từ chối ngay lập tức với CẢNH BÁO BẢO MẬT, tuyệt đối KHÔNG rơi xuống dò mờ
        let res = chay_go_cai_dat_registry_an_toan(
            "FakeAppThatDoesNotExist",
            Some("C:\\FakePath\\uninstall.exe"),
            Some("FakeNonExistentRegistryKey12345"),
        );
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(
            err.contains("CẢNH BÁO BẢO MẬT") && err.contains("không tồn tại trong Windows Registry"),
            "Lỗi trả về phải là cảnh báo từ chối do khóa không tồn tại, thực tế nhận: {}",
            err
        );
    }

    #[test]
    fn test_kiem_tra_ten_app_khop_registry_du_lieu_that_notepad_plus_plus() {
        // DELIV-44.2: Dữ liệu thật Notepad++ trên máy người dùng
        // repo: notepad-plus-plus, DisplayName: Notepad++ (64-bit x64), registry_key: Notepad++
        assert!(kiem_tra_ten_app_khop_registry(
            "notepad-plus-plus",
            "Notepad++ (64-bit x64)",
            Some("Notepad++")
        ));
    }

    #[test]
    fn test_kiem_tra_ten_app_khop_registry_du_lieu_that_obsidian() {
        // DELIV-44.2: Dữ liệu thật Obsidian trên máy người dùng
        // repo: obsidian-releases, DisplayName: Obsidian, registry_key: Obsidian
        assert!(kiem_tra_ten_app_khop_registry(
            "obsidian-releases",
            "Obsidian",
            Some("Obsidian")
        ));
    }

    #[test]
    fn test_kiem_tra_ten_app_khop_registry_spoof_tu_choi() {
        // DELIV-44.2: Chống IPC spoofing - app lạ không được mạo danh phần mềm hệ thống
        assert!(!kiem_tra_ten_app_khop_registry(
            "notepad-plus-plus",
            "Microsoft Office 365 ProPlus",
            Some("Office16.PROPLUS")
        ));
    }

    #[test]
    fn test_phan_tich_uninstall_string_msiexec_khong_doi_nham_co_khac() {
        // DELIV-44.2: Cờ bắt đầu bằng /i nhưng không phải /i cài đặt (như /ignore) không bị đổi thành /X
        let raw = "msiexec.exe /ignore /qn";
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "msiexec.exe");
        assert_eq!(args, "/ignore /qn");
    }

    #[test]
    fn test_phan_tich_uninstall_string_msiexec_co_nhay_kep_duong_dan_day_du() {
        // SEC-R8-02: Chuỗi UninstallString MSI có dấu nháy kép và đường dẫn tuyệt đối phải đổi /i thành /X
        let raw = r#""C:\Windows\System32\msiexec.exe" /i{12345678-ABCD-1234-ABCD-1234567890AB} /qn"#;
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "msiexec.exe");
        assert_eq!(args, "/X{12345678-ABCD-1234-ABCD-1234567890AB} /qn");
    }

    #[test]
    fn test_phan_tich_uninstall_string_msiexec_nhay_kep_don_gian() {
        // SEC-R8-02: Chuỗi UninstallString "msiexec.exe" /I{GUID} phải đổi thành /X
        let raw = r#""msiexec.exe" /I{12345678-ABCD-1234-ABCD-1234567890AB}"#;
        let (exe, args) = phan_tich_uninstall_string(raw);
        assert_eq!(exe, "msiexec.exe");
        assert_eq!(args, "/X{12345678-ABCD-1234-ABCD-1234567890AB}");
    }

    #[test]
    fn test_kiem_tra_ten_app_khop_registry_contains_tu_khoa_ngan_3_ky_tu_tu_choi() {
        // SEC-R8-04: Từ khóa 3 ký tự (git) không được match chứa (contains) vào phần mềm không liên quan (logitech)
        assert!(!kiem_tra_ten_app_khop_registry(
            "git",
            "Logitech G HUB",
            Some("Logitech.GHUB")
        ));
        // Nhưng exact match 3 ký tự (git) thì vẫn khớp chính xác
        assert!(kiem_tra_ten_app_khop_registry(
            "git",
            "Git",
            Some("Git")
        ));
    }

    #[test]
    fn test_trich_xuat_exe_tu_display_icon_du_lieu_that() {
        // L-01: Dữ liệu thật từ Windows Registry của Notepad++, DBeaver, Obsidian...
        let npp_icon = r#""C:\Program Files\Notepad++\notepad++.exe,0""#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(npp_icon),
            Some(PathBuf::from(r"C:\Program Files\Notepad++\notepad++.exe"))
        );

        let npp_icon_no_quotes = r#"C:\Program Files\Notepad++\notepad++.exe,0"#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(npp_icon_no_quotes),
            Some(PathBuf::from(r"C:\Program Files\Notepad++\notepad++.exe"))
        );

        let dbeaver_icon = r#"C:\Program Files\DBeaver\dbeaver.exe"#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(dbeaver_icon),
            Some(PathBuf::from(r"C:\Program Files\DBeaver\dbeaver.exe"))
        );

        let obsidian_icon = r#"C:\Users\TRANQUYET\AppData\Local\Programs\Obsidian\Obsidian.exe"#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(obsidian_icon),
            Some(PathBuf::from(r"C:\Users\TRANQUYET\AppData\Local\Programs\Obsidian\Obsidian.exe"))
        );

        let negative_icon_index = r#""C:\Apps\Custom\tool.exe",-102"#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(negative_icon_index),
            Some(PathBuf::from(r"C:\Apps\Custom\tool.exe"))
        );

        // Bỏ tiền tố \\?\ nếu có
        let verbatim_icon = r#"\\?\C:\Program Files\App\app.exe,0"#;
        assert_eq!(
            trich_xuat_exe_tu_display_icon(verbatim_icon),
            Some(PathBuf::from(r"C:\Program Files\App\app.exe"))
        );

        // Không phải tệp .exe thì từ chối (tránh dll hoặc ico)
        let dll_icon = r#"C:\Windows\System32\shell32.dll,22"#;
        assert_eq!(trich_xuat_exe_tu_display_icon(dll_icon), None);

        // R-01: Kiểm tra loại bỏ DisplayIcon trỏ vào msiexec, uninstaller, setup, install, update
        let msiexec_icon = r#"C:\Windows\system32\msiexec.exe,0"#;
        assert_eq!(trich_xuat_exe_tu_display_icon(msiexec_icon), None);

        let uninstall_icon = r#""C:\Program Files\App\uninstall.exe""#;
        assert_eq!(trich_xuat_exe_tu_display_icon(uninstall_icon), None);

        let unins000_icon = r#"C:\Program Files (x86)\Tool\unins000.exe"#;
        assert_eq!(trich_xuat_exe_tu_display_icon(unins000_icon), None);

        let setup_icon = r#""C:\Program Files (x86)\App\setup.exe""#;
        assert_eq!(trich_xuat_exe_tu_display_icon(setup_icon), None);

        let installer_icon = r#"D:\Games\installer.exe"#;
        assert_eq!(trich_xuat_exe_tu_display_icon(installer_icon), None);

        let update_icon = r#"C:\Users\User\AppData\Local\App\update.exe"#;
        assert_eq!(trich_xuat_exe_tu_display_icon(update_icon), None);
    }

    #[test]
    fn test_la_thu_muc_cai_dat_hop_le_du_lieu_that() {
        // R-06: Chặn mọi thư mục dưới Windows
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Windows\System32")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Windows\SysWOW64")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Windows\Installer\{341B2BF9-AA0C-4060-B485-05FB7C561C1A}")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\windows")));

        // R-06: Chặn Package Cache của Windows Installer / burn
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\ProgramData\Package Cache\{GUID}")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"D:\ProgramData\Package Cache")));

        // R-06: Chặn Temp nhưng không chặn nhầm Tempest
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Users\User\AppData\Local\Temp")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Temp")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\temp\app")));
        assert!(la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Program Files\Tempest")));

        // R-06: Chấp nhận các thư mục phần mềm hợp lệ
        assert!(la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Program Files\Flameshot")));
        assert!(la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Program Files\Notepad++")));
        assert!(la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Program Files\DBeaver")));
        assert!(la_thu_muc_cai_dat_hop_le(Path::new(r"D:\Software\PortableApp")));

        // R-06: Chặn ổ đĩa gốc
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"")));
    }

    #[test]
    fn test_la_tep_thuc_thi_app_hop_le_package_cache() {
        // R-06: Chặn tệp thực thi trong Package Cache
        assert!(!la_tep_thuc_thi_app_hop_le(Path::new(r"C:\ProgramData\Package Cache\setup.exe")));
        assert!(!la_tep_thuc_thi_app_hop_le(Path::new(r"C:\ProgramData\Package Cache\{GUID}\app.exe")));
    }

    #[test]
    fn test_la_thu_muc_cai_dat_hop_le_unc_va_83_sfn() {
        // SEC-R9-03: Cấm tuyệt đối UNC path chống rò rỉ NetNTLMv2 hash
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"\\attacker-ip\share")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"//attacker-ip/share")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"\??\UNC\attacker-ip\share")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"\\?\UNC\attacker-ip\share")));

        // SEC-R9-02: Cấm tên ngắn 8.3 SFN packag~1
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\ProgramData\PACKAG~1\{GUID}")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\packag~1")));

        // SEC-R9-02: Cấm temp và system32 có trailing dot
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\temp.\app")));
        assert!(!la_thu_muc_cai_dat_hop_le(Path::new(r"C:\Windows\System32.")));
    }

    #[test]
    fn test_tim_tep_thuc_thi_trong_thu_muc_cai_dat_path_traversal_tu_choi() {
        let temp_dir = std::env::temp_dir().join("fs_test_traversal");
        let _ = std::fs::create_dir_all(&temp_dir);

        // SEC-R9-01: Thử payload Path Traversal trong ten_app
        let traversal_result = tim_tep_thuc_thi_trong_thu_muc_cai_dat(&temp_dir, Some("../../Windows/System32/cmd"));
        assert_eq!(traversal_result, None);

        let slash_result = tim_tep_thuc_thi_trong_thu_muc_cai_dat(&temp_dir, Some("subdir/cmd"));
        assert_eq!(slash_result, None);

        let backslash_result = tim_tep_thuc_thi_trong_thu_muc_cai_dat(&temp_dir, Some(r"subdir\cmd"));
        assert_eq!(backslash_result, None);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_la_tep_thuc_thi_app_hop_le_duong_dan_co_tien_to() {
        // R-09: Đường dẫn có tiền tố \\?\ hoặc \??\ vẫn phải bị chặn nếu nằm dưới thư mục Windows
        assert!(la_thu_muc_windows(r"\\?\C:\Windows\notepad.exe"));
        assert!(la_thu_muc_windows(r"\??\C:\Windows\System32\cmd.exe"));
        assert!(!la_tep_thuc_thi_app_hop_le(std::path::Path::new(r"\\?\C:\Windows\notepad.exe")));
        assert!(!la_tep_thuc_thi_app_hop_le(std::path::Path::new(r"\??\C:\Windows\notepad.exe")));

        // Đường dẫn app hợp lệ có tiền tố vẫn được chấp nhận
        assert!(!la_thu_muc_windows(r"\\?\C:\Program Files\Notepad++\notepad++.exe"));
        assert!(la_tep_thuc_thi_app_hop_le(std::path::Path::new(
            r"\\?\C:\Program Files\Notepad++\notepad++.exe"
        )));
    }
}
