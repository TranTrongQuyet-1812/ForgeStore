use std::path::{Path, PathBuf};
use std::process::Command;

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


/// Kết quả sau khi chạy bộ cài đặt hoặc giải nén (P3-10)
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct KetQuaCaiDat {
    pub thanh_cong: bool,
    pub loai_cai_dat: String, // "EXE", "MSI", "PORTABLE_ZIP"
    pub thong_diep: String,
    pub duong_dan_cai_dat: Option<String>,
    pub duong_dan_thuc_thi: Option<String>,
    pub thong_tin_registry: Option<crate::uninstaller::ThongTinUngDungRegistry>,
}

/// Lấy thư mục gốc chứa các app portable được cài đặt: %LOCALAPPDATA%\ForgeStore\apps\<ten_app>\
pub fn lay_thu_muc_cai_dat_app(ten_app: &str) -> Result<PathBuf, String> {
    let base_dir = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."))
        });
    
    // Chuẩn hóa tên app an toàn cho thư mục
    let safe_app_name: String = ten_app
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    let app_dir = base_dir.join("ForgeStore").join("apps").join(safe_app_name);
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Không thể tạo thư mục cài đặt '{}': {}", app_dir.display(), e))?;
    Ok(app_dir)
}

/// Kiểm tra xem tệp có nằm trong thư mục dữ liệu an toàn của ForgeStore hay không (Điểm 3)
pub fn kiem_tra_tep_an_toan(duong_dan_tep: &Path) -> Result<PathBuf, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp không tồn tại: {}", duong_dan_tep.display()));
    }

    let canonical = duong_dan_tep
        .canonicalize()
        .map_err(|e| format!("Không thể giải quyết đường dẫn tệp: {}", e))?;

    let base_dir = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")));

    let forgestore_root = base_dir.join("ForgeStore");
    let forgestore_canonical = forgestore_root.canonicalize().unwrap_or(forgestore_root);

    if !canonical.starts_with(&forgestore_canonical) {
        return Err(format!(
            "BẢO MẬT: Đường dẫn '{}' nằm ngoài thư mục an toàn của ForgeStore.",
            canonical.display()
        ));
    }

    Ok(canonical)
}

/// Chạy bộ cài Windows .exe và chờ tiến trình kết thúc (P3-10.1 & Điểm 4, 5, Win32 UAC Elevation)
pub fn chay_bo_cai_exe(duong_dan_tep: &Path, ten_app: &str) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp cài đặt .exe không tồn tại: {}", duong_dan_tep.display()));
    }

    let safe_path = kiem_tra_tep_an_toan(duong_dan_tep)?;

    #[cfg(target_os = "windows")]
    let snapshot_truoc = crate::uninstaller::chup_snapshot_khoa_registry();

    #[cfg(target_os = "windows")]
    {
        // Khởi chạy file EXE qua ShellExecuteExW để kích hoạt hộp thoại UAC xin quyền Admin
        let path_wide: Vec<u16> = OsStr::new(safe_path.as_os_str())
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut sei: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        sei.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.fMask = SEE_MASK_NOCLOSEPROCESS;
        sei.lpFile = path_wide.as_ptr();
        sei.nShow = SW_SHOW as i32;

        // SEC-R7-07: Gán thư mục làm việc an toàn cho bộ cài EXE chống DLL Hijacking
        let default_sys32 = std::path::Path::new(r"C:\Windows\System32");
        let work_dir_path = safe_path
            .parent()
            .and_then(|p| if p.as_os_str().is_empty() { None } else { Some(p) })
            .unwrap_or(default_sys32);
        let work_dir_wide: Vec<u16> = OsStr::new(work_dir_path.as_os_str())
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        sei.lpDirectory = work_dir_wide.as_ptr();

        let success = unsafe { ShellExecuteExW(&mut sei) };
        if success == 0 {
            let err_code = unsafe { GetLastError() };
            if err_code == ERROR_CANCELLED {
                return Err("NGUOI_DUNG_HUY: Người dùng đã từ chối cấp quyền Quản trị viên (UAC).".to_string());
            }
            return Err(format!(
                "Không thể khởi chạy bộ cài đặt .exe qua ShellExecuteExW (mã lỗi Win32: {}).",
                err_code
            ));
        }

        let h_process = sei.hProcess;
        if !h_process.is_null() {
            unsafe {
                // SEC-R8-03: Đặt timeout bảo vệ 45 phút cho bộ cài đặt lớn, tránh khóa luồng Tokio vĩnh viễn nếu installer bị treo
                const TIMEOUT_INSTALL_MS: u32 = 45 * 60 * 1000;
                const WAIT_TIMEOUT_VAL: u32 = 258;

                let wait_res = WaitForSingleObject(h_process, TIMEOUT_INSTALL_MS);
                if wait_res == WAIT_TIMEOUT_VAL {
                    CloseHandle(h_process);
                    return Err("TIEN_TRINH_TREO: Quá trình cài đặt .exe vượt quá thời gian cho phép (45 phút).".to_string());
                }

                let mut exit_code: u32 = 0;
                GetExitCodeProcess(h_process, &mut exit_code);
                CloseHandle(h_process);

                if exit_code == 0 {
                    let thong_tin_registry = crate::uninstaller::tim_khoa_registry_moi(&snapshot_truoc, ten_app)
                        .or_else(|| crate::uninstaller::tim_ung_dung_chinh_xac_registry(ten_app, None, None));

                    Ok(KetQuaCaiDat {
                        thanh_cong: true,
                        loai_cai_dat: "EXE".to_string(),
                        thong_diep: "Đã cài đặt phần mềm (.exe) thành công.".to_string(),
                        duong_dan_cai_dat: None, // DELIV-44.3: Không lưu đường dẫn file bộ cài downloads mang tiền tố \\?\
                        duong_dan_thuc_thi: None, // Điểm 5: Không mở lại bộ cài
                        thong_tin_registry,
                    })
                } else {
                    Err(format!(
                        "Bộ cài đặt .exe kết thúc không thành công hoặc người dùng đã hủy (mã thoát: {}).",
                        exit_code
                    ))
                }
            }
        } else {
            let thong_tin_registry = crate::uninstaller::tim_khoa_registry_moi(&snapshot_truoc, ten_app)
                .or_else(|| crate::uninstaller::tim_ung_dung_chinh_xac_registry(ten_app, None, None));

            Ok(KetQuaCaiDat {
                thanh_cong: true,
                loai_cai_dat: "EXE".to_string(),
                thong_diep: "Đã khởi chạy bộ cài đặt .exe.".to_string(),
                duong_dan_cai_dat: None, // DELIV-44.3: Không lưu đường dẫn file bộ cài downloads mang tiền tố \\?\
                duong_dan_thuc_thi: None,
                thong_tin_registry,
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = ten_app;
        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "EXE".to_string(),
            thong_diep: "Môi trường không phải Windows, giả lập cài đặt .exe thành công.".to_string(),
            duong_dan_cai_dat: Some(safe_path.to_string_lossy().to_string()),
            duong_dan_thuc_thi: None,
            thong_tin_registry: None,
        })
    }
}

/// Chạy bộ cài Windows .msi qua msiexec.exe và kiểm tra mã thoát (P3-10.1 & Điểm 4, 5)
pub fn chay_bo_cai_msi(duong_dan_tep: &Path, ten_app: &str) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp cài đặt .msi không tồn tại: {}", duong_dan_tep.display()));
    }

    let safe_path = kiem_tra_tep_an_toan(duong_dan_tep)?;

    #[cfg(target_os = "windows")]
    let snapshot_truoc = crate::uninstaller::chup_snapshot_khoa_registry();

    #[cfg(target_os = "windows")]
    {
        let mut child = Command::new("msiexec.exe")
            .current_dir(r"C:\Windows\System32")
            .arg("/i")
            .arg(&safe_path)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy msiexec cho tệp .msi: {}", e))?;

        let status = child
            .wait()
            .map_err(|e| format!("Lỗi khi theo dõi tiến trình msiexec: {}", e))?;

        let code = status.code().unwrap_or(-1);
        match code {
            0 => {
                let thong_tin_registry = crate::uninstaller::tim_khoa_registry_moi(&snapshot_truoc, ten_app)
                    .or_else(|| crate::uninstaller::tim_ung_dung_chinh_xac_registry(ten_app, None, None));

                Ok(KetQuaCaiDat {
                    thanh_cong: true,
                    loai_cai_dat: "MSI".to_string(),
                    thong_diep: "Đã hoàn tất cài đặt Windows Installer (.msi) thành công.".to_string(),
                    duong_dan_cai_dat: None, // DELIV-44.3: Không lưu đường dẫn file bộ cài downloads mang tiền tố \\?\
                    duong_dan_thuc_thi: None, // Điểm 5: Không mở lại bộ cài
                    thong_tin_registry,
                })
            }
            1602 => Err("NGUOI_DUNG_HUY: Người dùng đã hủy tiến trình cài đặt Windows Installer (.msi).".to_string()),
            3010 => {
                let thong_tin_registry = crate::uninstaller::tim_khoa_registry_moi(&snapshot_truoc, ten_app)
                    .or_else(|| crate::uninstaller::tim_ung_dung_chinh_xac_registry(ten_app, None, None));

                Ok(KetQuaCaiDat {
                    thanh_cong: true,
                    loai_cai_dat: "MSI".to_string(),
                    thong_diep: "Cài đặt thành công nhưng hệ thống yêu cầu khởi động lại máy để hoàn tất.".to_string(),
                    duong_dan_cai_dat: None, // DELIV-44.3: Không lưu đường dẫn file bộ cài downloads mang tiền tố \\?\
                    duong_dan_thuc_thi: None,
                    thong_tin_registry,
                })
            }
            _ => Err(format!(
                "Bộ cài đặt Windows Installer kết thúc với mã lỗi: {}.",
                code
            )),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = ten_app;
        Ok(KetQuaCaiDat {
            thanh_cong: true,
            loai_cai_dat: "MSI".to_string(),
            thong_diep: "Môi trường không phải Windows, giả lập chạy msiexec thành công.".to_string(),
            duong_dan_cai_dat: Some(safe_path.to_string_lossy().to_string()),
            duong_dan_thuc_thi: None,
            thong_tin_registry: None,
        })
    }
}

/// Kiểm tra xem một thư mục có phải là thư mục hệ thống nguy hiểm hoặc thư mục gốc không (SEC-02 & SEC-04)
pub fn kiem_tra_thu_muc_an_toan(dir: &Path) -> Result<PathBuf, String> {
    if !dir.exists() {
        return Err(format!("Thư mục không tồn tại: {}", dir.display()));
    }
    let canonical = dir
        .canonicalize()
        .map_err(|e| format!("Không thể chuẩn hóa đường dẫn thư mục: {}", e))?;

    // 1. Cấm thư mục gốc ổ đĩa (vd: C:\, D:\)
    if canonical.parent().is_none() {
        return Err("BẢO MẬT: Không được phép sử dụng thư mục gốc của ổ đĩa làm ranh giới thực thi.".to_string());
    }

    // 2. Cấm thư mục Windows (%WINDIR%, System32)
    if let Ok(windir) = std::env::var("WINDIR") {
        if let Ok(canon_win) = PathBuf::from(windir).canonicalize() {
            if canonical.starts_with(&canon_win) {
                return Err("BẢO MẬT: Không được phép sử dụng thư mục hệ thống Windows.".to_string());
            }
        }
    }

    // 3. Cấm thư mục Program Files / Program Files (x86)
    for env_var in &["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
        if let Ok(pf) = std::env::var(env_var) {
            if let Ok(canon_pf) = PathBuf::from(pf).canonicalize() {
                if canonical.starts_with(&canon_pf) {
                    return Err("BẢO MẬT: Không được phép sử dụng thư mục Program Files của hệ thống.".to_string());
                }
            }
        }
    }

    // 4. Cấm thư mục Startup tự khởi động cùng Windows (cả APPDATA người dùng lẫn ProgramData toàn máy - SEC-04)
    if let Ok(appdata) = std::env::var("APPDATA") {
        let startup = PathBuf::from(appdata).join("Microsoft\\Windows\\Start Menu\\Programs\\Startup");
        if let Ok(canon_startup) = startup.canonicalize() {
            if canonical.starts_with(&canon_startup) {
                return Err("BẢO MẬT: Không được phép sử dụng thư mục Startup của người dùng.".to_string());
            }
        }
    }
    if let Ok(progdata) = std::env::var("ProgramData") {
        let startup_all = PathBuf::from(progdata).join("Microsoft\\Windows\\Start Menu\\Programs\\Startup");
        if let Ok(canon_startup_all) = startup_all.canonicalize() {
            if canonical.starts_with(&canon_startup_all) {
                return Err("BẢO MẬT: Không được phép sử dụng thư mục Startup chung của hệ thống Windows.".to_string());
            }
        }
    }

    Ok(canonical)
}

/// Kiểm tra xem tệp thực thi có nằm trong thư mục dữ liệu an toàn của ForgeStore
/// hoặc trong thư mục giải nén portable được người dùng chỉ định tường minh hay không (A1, SEC-02)
pub fn kiem_tra_tep_thuc_thi_an_toan(
    duong_dan_tep: &Path,
    thu_muc_cho_phep: Option<&Path>,
) -> Result<PathBuf, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp không tồn tại: {}", duong_dan_tep.display()));
    }

    let canonical = duong_dan_tep
        .canonicalize()
        .map_err(|e| format!("Không thể giải quyết đường dẫn tệp: {}", e))?;

    // SEC-R6-01 & SEC-R7-01: Bắt buộc phần mở rộng TRÊN ĐƯỜNG DẪN THỰC TẾ (CANONICAL) phải là .exe
    // Ngăn chặn kỹ thuật tạo symlink app.exe -> payload.bat để qua mặt bộ lọc trước khi canonicalize!
    let is_exe = canonical
        .extension()
        .and_then(|ext| ext.to_str())
        .map_or(false, |ext| ext.eq_ignore_ascii_case("exe"));
    if !is_exe {
        return Err("BẢO MẬT: Chỉ cho phép khởi chạy tệp thực thi định dạng .exe.".to_string());
    }

    let base_dir = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")));

    let forgestore_root = base_dir.join("ForgeStore");
    let forgestore_canonical = forgestore_root.canonicalize().unwrap_or(forgestore_root);

    // 1. Cho phép nếu nằm trong thư mục gốc ForgeStore
    if canonical.starts_with(&forgestore_canonical) {
        return Ok(canonical);
    }

    // 2. Cho phép nếu nằm trong thư mục người dùng đã chọn tường minh cho portable app (A1)
    // SEC-02: Phải kiểm tra thu_muc_cho_phep an toàn, cấm root C:\ hoặc thư mục hệ thống
    if let Some(allowed) = thu_muc_cho_phep {
        if let Ok(allowed_canonical) = kiem_tra_thu_muc_an_toan(allowed) {
            if canonical.starts_with(&allowed_canonical) {
                return Ok(canonical);
            }
        }
    }

    Err(format!(
        "BẢO MẬT: Đường dẫn '{}' nằm ngoài thư mục an toàn của ForgeStore và thư mục portable được phép.",
        canonical.display()
    ))
}

/// Giải nén bản Portable .zip và phòng chống lỗ hổng Zip Slip (P3-10.2, A1, SEC-03, SEC-04)
pub fn giai_nen_portable_zip(
    duong_dan_tep: &Path,
    ten_app: &str,
    thu_muc_tuy_chon: Option<&Path>,
) -> Result<KetQuaCaiDat, String> {
    if !duong_dan_tep.exists() {
        return Err(format!("Tệp nén .zip không tồn tại: {}", duong_dan_tep.display()));
    }

    let safe_path = kiem_tra_tep_an_toan(duong_dan_tep)?;

    // Chuẩn hóa tên app an toàn cho thư mục
    let safe_app_name: String = ten_app
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    // Nếu người dùng chọn thư mục đích (A1, SEC-04): kiểm tra an toàn thư mục đích
    // Nếu không: fallback về mặc định %LOCALAPPDATA%\ForgeStore\apps\<safe_app_name>
    let dest_dir = if let Some(custom_dir) = thu_muc_tuy_chon {
        let safe_custom = kiem_tra_thu_muc_an_toan(custom_dir)?;
        let target = safe_custom.join(&safe_app_name);
        std::fs::create_dir_all(&target)
            .map_err(|e| format!("Không thể tạo thư mục đích '{}': {}", target.display(), e))?;
        target
    } else {
        lay_thu_muc_cai_dat_app(ten_app)?
    };

    let canonical_dest = dest_dir.canonicalize()
        .map_err(|e| format!("Không thể chuẩn hóa đường dẫn đích: {}", e))?;

    let file = std::fs::File::open(&safe_path)
        .map_err(|e| format!("Không thể mở tệp zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Tệp không phải định dạng zip hợp lệ hoặc bị hỏng: {}", e))?;

    let mut potential_exe: Option<PathBuf> = None;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i)
            .map_err(|e| format!("Lỗi khi đọc phần tử zip #{}: {}", i, e))?;

        // Chặn lỗ hổng Zip-Slip Lớp 1 (P3-10.2): enclosed_name loại bỏ đường dẫn tương đối ../
        let enclosed_name = match zip_file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                return Err(format!(
                    "CẢNH BÁO AN NINH: Phát hiện tệp zip độc hại (Zip-Slip attempt): '{}'",
                    zip_file.name()
                ));
            }
        };

        let outpath = dest_dir.join(&enclosed_name);

        if zip_file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Không thể tạo thư mục con: {}", e))?;
            // SEC-03: Kiểm tra tính bao hàm của thư mục con vừa tạo
            if let Ok(canon_sub) = outpath.canonicalize() {
                if !canon_sub.starts_with(&canonical_dest) {
                    return Err("CẢNH BÁO AN NINH: Thư mục giải nén vượt ra ngoài thư mục an toàn!".to_string());
                }
            }
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Không thể tạo thư mục cha: {}", e))?;
                }
                // SEC-03: Chốt chặn Zip-Slip Lớp 2 chuẩn xác: Thư mục cha phải nằm trọn trong dest_dir
                let canon_parent = parent.canonicalize()
                    .map_err(|e| format!("Không thể chuẩn hóa thư mục cha: {}", e))?;
                if !canon_parent.starts_with(&canonical_dest) {
                    return Err("CẢNH BÁO AN NINH: Thư mục cha giải nén vượt ra ngoài thư mục an toàn!".to_string());
                }
            }

            // SEC-04 & SEC-V3-01: Kiểm tra symlink_metadata và canonicalize trước khi tạo/ghi tệp
            // Ngăn chặn triệt để TOCTOU Truncation: Nếu tệp đã tồn tại, kiểm tra xem nó có nằm trong canonical_dest không
            // trước khi File::create mở và truncate tệp!
            if outpath.exists() || outpath.symlink_metadata().is_ok() {
                if let Ok(meta) = outpath.symlink_metadata() {
                    if meta.file_type().is_symlink() {
                        return Err(format!(
                            "CẢNH BÁO AN NINH: Phát hiện tệp liên kết symlink nguy hiểm: '{}'",
                            outpath.display()
                        ));
                    }
                }
                if let Ok(canon_existing) = outpath.canonicalize() {
                    if !canon_existing.starts_with(&canonical_dest) {
                        return Err(format!(
                            "CẢNH BÁO AN NINH: Tệp đích hiện tại '{}' trỏ ra ngoài thư mục an toàn!",
                            outpath.display()
                        ));
                    }
                }
            }

            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Không thể tạo tệp giải nén '{}': {}", outpath.display(), e))?;

            // SEC-03: Kiểm tra tệp sau khi tạo xem có bị Symlink/Junction redirect ra ngoài không
            let canon_out = outpath.canonicalize()
                .map_err(|e| format!("Không thể chuẩn hóa tệp giải nén: {}", e))?;
            if !canon_out.starts_with(&canonical_dest) {
                let _ = std::fs::remove_file(&outpath);
                return Err("CẢNH BÁO AN NINH: Tệp giải nén vượt ra ngoài thư mục an toàn!".to_string());
            }

            std::io::copy(&mut zip_file, &mut outfile)
                .map_err(|e| format!("Lỗi khi ghi dữ liệu giải nén: {}", e))?;

            // Ghi nhận file .exe tiềm năng để người dùng mở trực tiếp
            if let Some(ext) = outpath.extension() {
                if ext.eq_ignore_ascii_case("exe") {
                    if potential_exe.is_none() || outpath.file_stem().map_or(false, |s| s.to_string_lossy().to_lowercase().contains(&ten_app.to_lowercase())) {
                        potential_exe = Some(outpath.clone());
                    }
                }
            }
        }
    }

    Ok(KetQuaCaiDat {
        thanh_cong: true,
        loai_cai_dat: "PORTABLE_ZIP".to_string(),
        thong_diep: format!("Đã giải nén bản portable vào '{}' thành công.", dest_dir.display()),
        duong_dan_cai_dat: Some(dest_dir.to_string_lossy().to_string()),
        duong_dan_thuc_thi: potential_exe.map(|p| p.to_string_lossy().to_string()),
        thong_tin_registry: None,
    })
}

/// Mở ứng dụng đã cài đặt qua đường dẫn thực thi (hỗ trợ cả app portable trong thư mục người dùng chọn)
pub fn mo_ung_dung_thuc_thi(duong_dan: &Path, thu_muc_cho_phep: Option<&Path>) -> Result<(), String> {
    if !duong_dan.exists() {
        return Err(format!("Đường dẫn thực thi không tồn tại: {}", duong_dan.display()));
    }

    let safe_path = kiem_tra_tep_thuc_thi_an_toan(duong_dan, thu_muc_cho_phep)?;

    #[cfg(target_os = "windows")]
    {
        let path_wide: Vec<u16> = OsStr::new(safe_path.as_os_str())
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut sei: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        sei.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.fMask = 0;
        sei.lpFile = path_wide.as_ptr();
        sei.nShow = SW_SHOW as i32;

        let success = unsafe { ShellExecuteExW(&mut sei) };
        if success == 0 {
            let err_code = unsafe { GetLastError() };
            if err_code == ERROR_CANCELLED {
                return Err("NGUOI_DUNG_HUY: Người dùng đã từ chối cấp quyền khi mở ứng dụng.".to_string());
            }
            return Err(format!("Không thể mở ứng dụng (mã lỗi Win32: {}).", err_code));
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

/// Mở thư mục an toàn trong Windows File Explorer (A1, TC-09)
/// Kiểm tra nghiêm ngặt: Đường dẫn bắt buộc phải tồn tại và là thư mục (is_dir).
/// Tuyệt đối từ chối nếu là tệp tin để ngăn chặn tấn công thực thi mã tùy ý từ Webview.
pub fn mo_thu_muc_he_thong(duong_dan: &Path) -> Result<(), String> {
    // SEC-R6-03, SEC-R7-06 & SEC-R8-05: Cấm tuyệt đối đường dẫn mạng UNC (\\ hoặc //) và NT Object Manager device path (\??\ hoặc \\?\)
    // Chuẩn hóa trim() để tránh bypass bằng khoảng trắng dẫn đầu, chống rò rỉ băm NetNTLMv2 qua SMB
    let path_str = duong_dan.to_string_lossy();
    let trimmed = path_str.trim();
    if trimmed.starts_with(r"\\")
        || trimmed.starts_with("//")
        || trimmed.starts_with(r"\??\")
        || trimmed.starts_with(r"\\?\")
    {
        return Err("BẢO MẬT: Không được phép mở đường dẫn mạng UNC hoặc thiết bị NT.".to_string());
    }

    if !duong_dan.exists() {
        return Err(format!("Đường dẫn thư mục không tồn tại: {}", duong_dan.display()));
    }

    if !duong_dan.is_dir() {
        return Err(format!("BẢO MẬT: Đường dẫn '{}' không phải là thư mục. Thao tác bị từ chối!", duong_dan.display()));
    }

    #[cfg(target_os = "windows")]
    {
        // DELIV-44.3: Sử dụng đường dẫn tuyệt đối C:\Windows\explorer.exe thay vì lệnh explorer chung
        let explorer_path = std::env::var("WINDIR")
            .map(|w| format!("{}\\explorer.exe", w))
            .unwrap_or_else(|_| r"C:\Windows\explorer.exe".to_string());
        std::process::Command::new(explorer_path)
            .arg(duong_dan)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy Windows File Explorer: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mo_thu_muc_he_thong_unc_tu_choi() {
        let res = mo_thu_muc_he_thong(Path::new(r"\\attacker-ip\share"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("đường dẫn mạng UNC"));
    }

    #[test]
    fn test_mo_thu_muc_he_thong_nt_device_path_tu_choi() {
        let res = mo_thu_muc_he_thong(Path::new(r"\??\UNC\attacker-ip\share"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("đường dẫn mạng UNC hoặc thiết bị NT"));
    }

    #[test]
    fn test_kiem_tra_tep_thuc_thi_an_toan_duoi_khong_phai_exe() {
        let temp_dir = std::env::temp_dir();
        let bat_file = temp_dir.join("forgestore_test_evil.bat");
        let _ = std::fs::File::create(&bat_file);

        let res = kiem_tra_tep_thuc_thi_an_toan(&bat_file, Some(&temp_dir));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("định dạng .exe"));

        let _ = std::fs::remove_file(&bat_file);
    }

    #[test]
    fn test_mo_thu_muc_he_thong_khong_ton_tai() {
        let res = mo_thu_muc_he_thong(Path::new("C:\\invalid\\nonexistent_dir_12345"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_mo_thu_muc_he_thong_la_tep_tin_tu_choi() {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("forgestore_test_not_a_dir.tmp");
        let _ = std::fs::File::create(&temp_file);

        let res = mo_thu_muc_he_thong(&temp_file);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không phải là thư mục"));

        let _ = std::fs::remove_file(&temp_file);
    }

    #[test]
    fn test_lay_thu_muc_cai_dat_app() {
        let res = lay_thu_muc_cai_dat_app("RustDesk App!@#");
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.to_string_lossy().contains("ForgeStore"));
        assert!(path.to_string_lossy().contains("RustDesk_App___"));
    }

    #[test]
    fn test_chay_bo_cai_exe_file_khong_ton_tai() {
        let res = chay_bo_cai_exe(Path::new("C:\\invalid\\path\\nonexistent.exe"), "TestApp");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_chay_bo_cai_msi_file_khong_ton_tai() {
        let res = chay_bo_cai_msi(Path::new("C:\\invalid\\path\\nonexistent.msi"), "TestApp");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_giai_nen_zip_file_khong_ton_tai() {
        let res = giai_nen_portable_zip(Path::new("C:\\invalid\\path\\nonexistent.zip"), "TestApp", None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_giai_nen_zip_voi_thu_muc_tuy_chon_file_khong_ton_tai() {
        let custom_dir = Path::new("D:\\MyApps");
        let res = giai_nen_portable_zip(Path::new("C:\\invalid\\path\\nonexistent.zip"), "TestApp", Some(custom_dir));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("không tồn tại"));
    }

    #[test]
    fn test_kiem_tra_tep_thuc_thi_an_toan_khong_ton_tai() {
        let res = kiem_tra_tep_thuc_thi_an_toan(Path::new("C:\\invalid\\nonexistent.exe"), None);
        assert!(res.is_err());
    }

    #[test]
    fn test_kiem_tra_thu_muc_an_toan_cam_root() {
        // SEC-02 & SEC-04: Cấm thư mục gốc ổ đĩa
        let res = kiem_tra_thu_muc_an_toan(Path::new("C:\\"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("gốc của ổ đĩa"));
    }

    #[test]
    fn test_kiem_tra_thu_muc_an_toan_cam_windows() {
        // SEC-02 & SEC-04: Cấm thư mục hệ thống Windows
        if let Ok(windir) = std::env::var("WINDIR") {
            let res = kiem_tra_thu_muc_an_toan(Path::new(&windir));
            assert!(res.is_err());
            assert!(res.unwrap_err().contains("hệ thống Windows"));
        }
    }

    #[test]
    fn test_kiem_tra_thu_muc_an_toan_cho_phep_temp() {
        let temp = std::env::temp_dir();
        let res = kiem_tra_thu_muc_an_toan(&temp);
        assert!(res.is_ok());
    }

    #[test]
    fn test_mo_thu_muc_he_thong_unc_co_khoang_trang_dau_tu_choi() {
        // SEC-R8-05: Đường dẫn UNC có khoảng trắng dẫn đầu vẫn phải bị từ chối
        let res = mo_thu_muc_he_thong(Path::new("  \\\\attacker\\share"));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("đường dẫn mạng UNC"));
    }
}

