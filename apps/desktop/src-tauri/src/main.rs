// Ngăn cửa sổ console phụ xuất hiện trên Windows ở chế độ phát hành (release), KHÔNG ĐƯỢC XÓA!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    forgestore_desktop_lib::run();
}
