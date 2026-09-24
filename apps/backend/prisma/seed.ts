import { DinhDangTep, KienTrucChip, MucDoUyTin, NenTangHoTro, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedAppItem {
  tenRepoDayDu: string;
  chuSoHuu: string;
  tenKhoChua: string;
  duongDanGithub: string;
  moTaGocTiengAnh: string;
  duongDanIcon: string;
  soSaoGithub: number;
  soLuotFork: number;
  loaiGiayPhep: string;
  ngonNguChinh: string;
  danhSachChuDe: string[];
  danhMucChinh: string;
  nenTangHoTro: NenTangHoTro;
  duocNoiBat: boolean;
  daXacMinh: boolean;
  tenGoiAndroid?: string;
  khauHieuTiengViet: string;
  tomTatTinhNangVi: string;
  diemUyTin: number;
  mucDoAnToan: MucDoUyTin;
  tenPhienBan: string;
  tieuDePhatHanh: string;
  files: {
    tenTep: string;
    duongDanTaiVe: string;
    dungLuongBytes: bigint;
    dinhDangTep: DinhDangTep;
    kienTrucChip: KienTrucChip;
    soLuotTai: number;
  }[];
}

const SEED_APPS: SeedAppItem[] = [
  // 1. RustDesk (Đa nền tảng)
  {
    tenRepoDayDu: 'rustdesk/rustdesk',
    chuSoHuu: 'rustdesk',
    tenKhoChua: 'rustdesk',
    duongDanGithub: 'https://github.com/rustdesk/rustdesk',
    moTaGocTiengAnh: 'An open-source remote desktop application written in Rust',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/71630733?v=4',
    soSaoGithub: 78500,
    soLuotFork: 9500,
    loaiGiayPhep: 'AGPL-3.0',
    ngonNguChinh: 'Rust',
    danhSachChuDe: ['remote-desktop', 'rust', 'p2p', 'webrtc'],
    danhMucChinh: 'Mạng & Giao tiếp',
    nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'com.carriez.rustdesk',
    khauHieuTiengViet: 'Điều khiển máy tính từ xa mã nguồn mở, bảo mật và siêu tốc',
    tomTatTinhNangVi:
      '• Tự chủ máy chủ trung gian không lo lộ dữ liệu\n• Mã hóa đầu cuối P2P chuẩn quân đội\n• Hỗ trợ đa nền tảng Windows, Android, Linux',
    diemUyTin: 96,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '1.2.3',
    tieuDePhatHanh: 'RustDesk 1.2.3 Release',
    files: [
      {
        tenTep: 'rustdesk-1.2.3-x86_64.exe',
        duongDanTaiVe:
          'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-x86_64.exe',
        dungLuongBytes: BigInt(26214400),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 125000,
      },
      {
        tenTep: 'rustdesk-1.2.3-arm64-v8a.apk',
        duongDanTaiVe:
          'https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-arm64-v8a.apk',
        dungLuongBytes: BigInt(18874368),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 84000,
      },
    ],
  },

  // 2. VLC (Đa nền tảng)
  {
    tenRepoDayDu: 'videolan/vlc',
    chuSoHuu: 'videolan',
    tenKhoChua: 'vlc',
    duongDanGithub: 'https://github.com/videolan/vlc',
    moTaGocTiengAnh: 'VLC media player is a free and open source cross-platform multimedia player',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/104113?v=4',
    soSaoGithub: 13500,
    soLuotFork: 4800,
    loaiGiayPhep: 'GPL-2.0',
    ngonNguChinh: 'C',
    danhSachChuDe: ['media-player', 'video', 'audio', 'streaming'],
    danhMucChinh: 'Đa phương tiện',
    nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'org.videolan.vlc',
    khauHieuTiengViet: 'Trình phát đa phương tiện miễn phí, mở được mọi định dạng video',
    tomTatTinhNangVi:
      '• Chạy mượt mọi codec âm thanh và hình ảnh phổ biến\n• Tối ưu phần cứng giải mã 4K/8K\n• Không quảng cáo, không theo dõi người dùng',
    diemUyTin: 98,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '3.0.20',
    tieuDePhatHanh: 'VLC 3.0.20 "Vetinari"',
    files: [
      {
        tenTep: 'vlc-3.0.20-win64.exe',
        duongDanTaiVe: 'https://get.videolan.org/vlc/3.0.20/win64/vlc-3.0.20-win64.exe',
        dungLuongBytes: BigInt(42991616),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 540000,
      },
      {
        tenTep: 'VLC-Android-3.5.4-arm64-v8a.apk',
        duongDanTaiVe: 'https://get.videolan.org/vlc-android/3.5.4/VLC-Android-3.5.4-arm64-v8a.apk',
        dungLuongBytes: BigInt(35651584),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 320000,
      },
    ],
  },

  // 3. LocalSend (Đa nền tảng)
  {
    tenRepoDayDu: 'localsend/localsend',
    chuSoHuu: 'localsend',
    tenKhoChua: 'localsend',
    duongDanGithub: 'https://github.com/localsend/localsend',
    moTaGocTiengAnh: 'An open-source cross-platform alternative to AirDrop',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/118318858?v=4',
    soSaoGithub: 52000,
    soLuotFork: 3400,
    loaiGiayPhep: 'MIT',
    ngonNguChinh: 'Dart',
    danhSachChuDe: ['airdrop', 'file-sharing', 'p2p', 'cross-platform'],
    danhMucChinh: 'Mạng & Giao tiếp',
    nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'org.localsend.localsend_app',
    khauHieuTiengViet: 'Chia sẻ tệp nội bộ siêu tốc, giải pháp AirDrop nguồn mở đa nền tảng',
    tomTatTinhNangVi:
      '• Chuyển file tốc độ cao trong mạng LAN không tốn Internet\n• Bảo mật bằng chứng chỉ TLS tự ký\n• Tự động nhận diện thiết bị xung quanh',
    diemUyTin: 95,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v1.14.0',
    tieuDePhatHanh: 'LocalSend v1.14.0',
    files: [
      {
        tenTep: 'LocalSend-1.14.0-windows-x86-64.zip',
        duongDanTaiVe:
          'https://github.com/localsend/localsend/releases/download/v1.14.0/LocalSend-1.14.0-windows-x86-64.zip',
        dungLuongBytes: BigInt(33554432),
        dinhDangTep: DinhDangTep.ZIP_PORTABLE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 98000,
      },
      {
        tenTep: 'LocalSend-1.14.0.apk',
        duongDanTaiVe:
          'https://github.com/localsend/localsend/releases/download/v1.14.0/LocalSend-1.14.0.apk',
        dungLuongBytes: BigInt(31457280),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.DUNG_CHUNG,
        soLuotTai: 145000,
      },
    ],
  },

  // 4. KeePassXC (Windows)
  {
    tenRepoDayDu: 'keepassxreboot/keepassxc',
    chuSoHuu: 'keepassxreboot',
    tenKhoChua: 'keepassxc',
    duongDanGithub: 'https://github.com/keepassxreboot/keepassxc',
    moTaGocTiengAnh: 'KeePassXC is a modern, secure, and open-source password manager',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/23588235?v=4',
    soSaoGithub: 23000,
    soLuotFork: 1700,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['password-manager', 'security', 'encryption', 'privacy'],
    danhMucChinh: 'Bảo mật & Quyền riêng tư',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: true,
    daXacMinh: true,
    khauHieuTiengViet: 'Két sắt quản lý mật khẩu ngoại tuyến an toàn bậc nhất',
    tomTatTinhNangVi:
      '• Cơ sở dữ liệu mã hóa AES-256 hoàn toàn offline\n• Tích hợp tính năng tự điền Auto-Type thông minh\n• Hỗ trợ tạo mã xác thực 2 bước TOTP tích hợp sẵn',
    diemUyTin: 99,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '2.7.9',
    tieuDePhatHanh: 'KeePassXC 2.7.9',
    files: [
      {
        tenTep: 'KeePassXC-2.7.9-Win64.msi',
        duongDanTaiVe:
          'https://github.com/keepassxreboot/keepassxc/releases/download/2.7.9/KeePassXC-2.7.9-Win64.msi',
        dungLuongBytes: BigInt(46137344),
        dinhDangTep: DinhDangTep.MSI,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 180000,
      },
    ],
  },

  // 5. Obsidian (Windows)
  {
    tenRepoDayDu: 'obsidianmd/obsidian-releases',
    chuSoHuu: 'obsidianmd',
    tenKhoChua: 'obsidian-releases',
    duongDanGithub: 'https://github.com/obsidianmd/obsidian-releases',
    moTaGocTiengAnh: 'Community plugins, themes, and releases of Obsidian',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/65011256?v=4',
    soSaoGithub: 8900,
    soLuotFork: 1500,
    loaiGiayPhep: 'Custom',
    ngonNguChinh: 'TypeScript',
    danhSachChuDe: ['notes', 'markdown', 'knowledge-base', 'productivity'],
    danhMucChinh: 'Năng suất & Văn phòng',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: true,
    daXacMinh: true,
    khauHieuTiengViet: 'Bộ não thứ hai kết nối ý tưởng qua văn bản Markdown',
    tomTatTinhNangVi:
      '• Lưu trữ cục bộ vĩnh viễn trên máy không phụ thuộc đám mây\n• Đồ thị kết nối tri thức Graph View trực quan\n• Hệ sinh thái plugin mở rộng không giới hạn',
    diemUyTin: 92,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v1.6.7',
    tieuDePhatHanh: 'Obsidian v1.6.7',
    files: [
      {
        tenTep: 'Obsidian-1.6.7.exe',
        duongDanTaiVe:
          'https://github.com/obsidianmd/obsidian-releases/releases/download/v1.6.7/Obsidian-1.6.7.exe',
        dungLuongBytes: BigInt(89128960),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 310000,
      },
    ],
  },

  // 6. Mihon (Android)
  {
    tenRepoDayDu: 'mihonapp/mihon',
    chuSoHuu: 'mihonapp',
    tenKhoChua: 'mihon',
    duongDanGithub: 'https://github.com/mihonapp/mihon',
    moTaGocTiengAnh: 'Free and open source manga reader for Android',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/156711690?v=4',
    soSaoGithub: 11200,
    soLuotFork: 650,
    loaiGiayPhep: 'Apache-2.0',
    ngonNguChinh: 'Kotlin',
    danhSachChuDe: ['manga', 'reader', 'comics', 'android'],
    danhMucChinh: 'Học tập & Giáo dục',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'eu.kanade.tachiyomi',
    khauHieuTiengViet: 'Trình đọc truyện tranh nguồn mở mượt mà và cá nhân hóa cho Android',
    tomTatTinhNangVi:
      '• Trải nghiệm đọc ngoại tuyến tải xuống tiện lợi\n• Tự động sao lưu tiến trình đọc qua đám mây\n• Giao diện Material You tối tân, không quảng cáo',
    diemUyTin: 94,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v0.16.5',
    tieuDePhatHanh: 'Mihon v0.16.5',
    files: [
      {
        tenTep: 'mihon-arm64-v8a-v0.16.5.apk',
        duongDanTaiVe:
          'https://github.com/mihonapp/mihon/releases/download/v0.16.5/mihon-arm64-v8a-v0.16.5.apk',
        dungLuongBytes: BigInt(24117248),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 210000,
      },
    ],
  },

  // 7. RetroArch (Đa nền tảng)
  {
    tenRepoDayDu: 'libretro/RetroArch',
    chuSoHuu: 'libretro',
    tenKhoChua: 'RetroArch',
    duongDanGithub: 'https://github.com/libretro/RetroArch',
    moTaGocTiengAnh: 'Cross-platform, sophisticated frontend for the libretro API',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/1614044?v=4',
    soSaoGithub: 10400,
    soLuotFork: 1800,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C',
    danhSachChuDe: ['emulator', 'gaming', 'retroarch', 'arcade'],
    danhMucChinh: 'Trò chơi & Giải trí',
    nenTangHoTro: NenTangHoTro.DA_NEN_TANG,
    duocNoiBat: false,
    daXacMinh: true,
    tenGoiAndroid: 'com.retroarch',
    khauHieuTiengViet: 'Trung tâm giả lập game cổ điển mạnh mẽ nhất thế giới',
    tomTatTinhNangVi:
      '• Hỗ trợ hàng trăm dòng máy cổ điển NES, PS1, GBA, PSP\n• Giảm độ trễ đầu vào Next-Frame Response\n• Bộ lọc đồ họa Shaders sắc nét chuẩn CRT',
    diemUyTin: 93,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v1.19.1',
    tieuDePhatHanh: 'RetroArch 1.19.1',
    files: [
      {
        tenTep: 'RetroArch-1.19.1-x86_64-setup.exe',
        duongDanTaiVe:
          'https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch-1.19.1-x86_64-setup.exe',
        dungLuongBytes: BigInt(214958080),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 154000,
      },
      {
        tenTep: 'RetroArch_aarch64.apk',
        duongDanTaiVe: 'https://buildbot.libretro.com/stable/1.19.1/android/RetroArch_aarch64.apk',
        dungLuongBytes: BigInt(188743680),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 110000,
      },
    ],
  },

  // 8. PowerToys (Windows)
  {
    tenRepoDayDu: 'microsoft/PowerToys',
    chuSoHuu: 'microsoft',
    tenKhoChua: 'PowerToys',
    duongDanGithub: 'https://github.com/microsoft/PowerToys',
    moTaGocTiengAnh: 'Windows system utilities to maximize productivity',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/6154722?v=4',
    soSaoGithub: 114000,
    soLuotFork: 6400,
    loaiGiayPhep: 'MIT',
    ngonNguChinh: 'C#',
    danhSachChuDe: ['windows', 'productivity', 'utilities', 'powertoys'],
    danhMucChinh: 'Tiện ích hệ thống',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: true,
    daXacMinh: true,
    khauHieuTiengViet: 'Bộ tiện ích chính chủ nâng tầm trải nghiệm làm việc trên Windows',
    tomTatTinhNangVi:
      '• FancyZones chia khung màn hình linh hoạt cho đa nhiệm\n• PowerToys Run tìm kiếm ứng dụng và tính toán tức thì\n• Text Extractor trích xuất chữ OCR từ bất kỳ đâu trên màn hình',
    diemUyTin: 98,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v0.84.1',
    tieuDePhatHanh: 'PowerToys Release v0.84.1',
    files: [
      {
        tenTep: 'PowerToysSetup-0.84.1-x64.exe',
        duongDanTaiVe:
          'https://github.com/microsoft/PowerToys/releases/download/v0.84.1/PowerToysSetup-0.84.1-x64.exe',
        dungLuongBytes: BigInt(125829120),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 620000,
      },
    ],
  },

  // 9. Notepad++ (Windows)
  {
    tenRepoDayDu: 'notepad-plus-plus/notepad-plus-plus',
    chuSoHuu: 'notepad-plus-plus',
    tenKhoChua: 'notepad-plus-plus',
    duongDanGithub: 'https://github.com/notepad-plus-plus/notepad-plus-plus',
    moTaGocTiengAnh: 'Notepad++ official repository',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/12028682?v=4',
    soSaoGithub: 23500,
    soLuotFork: 4600,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['text-editor', 'editor', 'windows', 'c-plus-plus'],
    danhMucChinh: 'Lập trình & Phát triển',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Trình biên tập văn bản và mã nguồn siêu nhẹ kinh điển',
    tomTatTinhNangVi:
      '• Tốc độ mở file tức thì không ngốn RAM\n• Tô sáng cú pháp cho hàng chục ngôn ngữ lập trình\n• Hỗ trợ Macro ghi lại thao tác chỉnh sửa tự động',
    diemUyTin: 97,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v8.6.9',
    tieuDePhatHanh: 'Notepad++ 8.6.9 release',
    files: [
      {
        tenTep: 'npp.8.6.9.Installer.x64.exe',
        duongDanTaiVe:
          'https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.6.9/npp.8.6.9.Installer.x64.exe',
        dungLuongBytes: BigInt(5242880),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 450000,
      },
    ],
  },

  // 10. Termux (Android)
  {
    tenRepoDayDu: 'termux/termux-app',
    chuSoHuu: 'termux',
    tenKhoChua: 'termux-app',
    duongDanGithub: 'https://github.com/termux/termux-app',
    moTaGocTiengAnh:
      'Termux - a terminal emulator application for Android OS extendible by variety of packages',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/17260570?v=4',
    soSaoGithub: 35000,
    soLuotFork: 4200,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'Java',
    danhSachChuDe: ['terminal', 'linux', 'android', 'shell'],
    danhMucChinh: 'Lập trình & Phát triển',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'com.termux',
    khauHieuTiengViet: 'Hệ môi trường dòng lệnh Linux hoàn chỉnh trong lòng bàn tay',
    tomTatTinhNangVi:
      '• Chạy môi trường Linux native không cần root máy\n• Cài đặt package qua trình quản lý APT (Python, Node.js, C++)\n• Tương thích SSH client và server đầy đủ',
    diemUyTin: 96,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v0.118.1',
    tieuDePhatHanh: 'Termux v0.118.1',
    files: [
      {
        tenTep: 'termux-app_v0.118.1+github-debug_arm64-v8a.apk',
        duongDanTaiVe:
          'https://github.com/termux/termux-app/releases/download/v0.118.1/termux-app_v0.118.1+github-debug_arm64-v8a.apk',
        dungLuongBytes: BigInt(33554432),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 280000,
      },
    ],
  },

  // 11. Flameshot (Windows)
  {
    tenRepoDayDu: 'flameshot-org/flameshot',
    chuSoHuu: 'flameshot-org',
    tenKhoChua: 'flameshot',
    duongDanGithub: 'https://github.com/flameshot-org/flameshot',
    moTaGocTiengAnh: 'Powerful yet simple to use screenshot software',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/60456576?v=4',
    soSaoGithub: 25000,
    soLuotFork: 1600,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['screenshot', 'capture', 'image', 'tools'],
    danhMucChinh: 'Đa phương tiện',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Công cụ chụp ảnh màn hình mạnh mẽ kèm chú thích trực tiếp',
    tomTatTinhNangVi:
      '• Vẽ mũi tên, đóng khung, làm mờ pixel che thông tin nhạy cảm\n• Tải ảnh chụp lên Imgur một chạm\n• Tùy biến phím tắt và giao diện phong phú',
    diemUyTin: 95,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v12.1.0',
    tieuDePhatHanh: 'Flameshot v12.1.0',
    files: [
      {
        tenTep: 'Flameshot-12.1.0-win64.msi',
        duongDanTaiVe:
          'https://github.com/flameshot-org/flameshot/releases/download/v12.1.0/Flameshot-12.1.0-win64.msi',
        dungLuongBytes: BigInt(57671680),
        dinhDangTep: DinhDangTep.MSI,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 120000,
      },
    ],
  },

  // 12. ShareX (Windows)
  {
    tenRepoDayDu: 'ShareX/ShareX',
    chuSoHuu: 'ShareX',
    tenKhoChua: 'ShareX',
    duongDanGithub: 'https://github.com/ShareX/ShareX',
    moTaGocTiengAnh:
      'ShareX is a free and open source program that lets you capture or record any area of your screen',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/10437435?v=4',
    soSaoGithub: 29000,
    soLuotFork: 2800,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C#',
    danhSachChuDe: ['screen-recorder', 'screenshot', 'gif', 'windows'],
    danhMucChinh: 'Đa phương tiện',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: true,
    daXacMinh: true,
    khauHieuTiengViet: 'Bộ công cụ quay chụp màn hình đa năng hàng đầu trên Windows',
    tomTatTinhNangVi:
      '• Quay video màn hình và xuất ảnh động GIF chất lượng cao\n• Hỗ trợ thước đo pixel và bảng chọn màu Color Picker\n• Tự động tải tệp lên hơn 80 dịch vụ lưu trữ',
    diemUyTin: 96,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v16.1.0',
    tieuDePhatHanh: 'ShareX 16.1.0 release',
    files: [
      {
        tenTep: 'ShareX-16.1.0-setup.exe',
        duongDanTaiVe:
          'https://github.com/ShareX/ShareX/releases/download/v16.1.0/ShareX-16.1.0-setup.exe',
        dungLuongBytes: BigInt(37748736),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 230000,
      },
    ],
  },

  // 13. KOReader (Android)
  {
    tenRepoDayDu: 'koreader/koreader',
    chuSoHuu: 'koreader',
    tenKhoChua: 'koreader',
    duongDanGithub: 'https://github.com/koreader/koreader',
    moTaGocTiengAnh:
      'An ebook reader application supporting PDF, EPUB, DJVU, and many more formats',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/4754705?v=4',
    soSaoGithub: 17800,
    soLuotFork: 1400,
    loaiGiayPhep: 'AGPL-3.0',
    ngonNguChinh: 'Lua',
    danhSachChuDe: ['ebook', 'pdf', 'epub', 'reader'],
    danhMucChinh: 'Học tập & Giáo dục',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: false,
    daXacMinh: true,
    tenGoiAndroid: 'org.koreader.launcher',
    khauHieuTiengViet: 'Trình đọc sách điện tử tối ưu cho cả màn hình E-Ink và điện thoại',
    tomTatTinhNangVi:
      '• Đọc PDF tái cấu trúc dòng chữ thông minh (Reflow)\n• Hỗ trợ từ điển ngoại tuyến tra cứu ngay khi chạm\n• Đồng bộ tiến trình đọc sách đa thiết bị qua Kosync',
    diemUyTin: 94,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v2024.07',
    tieuDePhatHanh: 'KOReader 2024.07',
    files: [
      {
        tenTep: 'koreader-android-arm64-v2024.07.apk',
        duongDanTaiVe:
          'https://github.com/koreader/koreader/releases/download/v2024.07/koreader-android-arm64-v2024.07.apk',
        dungLuongBytes: BigInt(49283072),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 76000,
      },
    ],
  },

  // 14. Cryptomator (Windows)
  {
    tenRepoDayDu: 'cryptomator/cryptomator',
    chuSoHuu: 'cryptomator',
    tenKhoChua: 'cryptomator',
    duongDanGithub: 'https://github.com/cryptomator/cryptomator',
    moTaGocTiengAnh: 'Multi-platform transparent client-side encryption of your files in the cloud',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/13247076?v=4',
    soSaoGithub: 11000,
    soLuotFork: 950,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'Java',
    danhSachChuDe: ['encryption', 'cloud-storage', 'privacy', 'security'],
    danhMucChinh: 'Bảo mật & Quyền riêng tư',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Mã hóa tệp tin phía máy khách bảo vệ dữ liệu đám mây',
    tomTatTinhNangVi:
      '• Mã hóa AES-256 trong suốt ngay trước khi đồng bộ lên Drive/OneDrive\n• Kiến trúc Zero-Knowledge: nhà cung cấp đám mây không thể đọc trộm\n• Không cần tạo tài khoản hay đăng ký dịch vụ',
    diemUyTin: 97,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '1.13.0',
    tieuDePhatHanh: 'Cryptomator 1.13.0',
    files: [
      {
        tenTep: 'Cryptomator-1.13.0-x64.exe',
        duongDanTaiVe:
          'https://github.com/cryptomator/cryptomator/releases/download/1.13.0/Cryptomator-1.13.0-x64.exe',
        dungLuongBytes: BigInt(54525952),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 85000,
      },
    ],
  },

  // 15. Syncthing (Android)
  {
    tenRepoDayDu: 'syncthing/syncthing-android',
    chuSoHuu: 'syncthing',
    tenKhoChua: 'syncthing-android',
    duongDanGithub: 'https://github.com/syncthing/syncthing-android',
    moTaGocTiengAnh: 'Wrapper of Syncthing for Android',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/5923267?v=4',
    soSaoGithub: 4100,
    soLuotFork: 600,
    loaiGiayPhep: 'MPL-2.0',
    ngonNguChinh: 'Java',
    danhSachChuDe: ['p2p', 'sync', 'backup', 'android'],
    danhMucChinh: 'Mạng & Giao tiếp',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: false,
    daXacMinh: true,
    tenGoiAndroid: 'com.nutomic.syncthingandroid',
    khauHieuTiengViet: 'Đồng bộ tệp tin ngang hàng liên tục không qua trung gian',
    tomTatTinhNangVi:
      '• Đồng bộ thư mục ảnh và dữ liệu tự động sang máy tính\n• Mã hóa bảo vệ chuẩn TLS khi truyền qua mạng Internet\n• Tự động dừng đồng bộ khi pin yếu để tiết kiệm năng lượng',
    diemUyTin: 95,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '1.27.10',
    tieuDePhatHanh: 'Syncthing-Android 1.27.10',
    files: [
      {
        tenTep: 'syncthing-arm64-1.27.10.apk',
        duongDanTaiVe:
          'https://github.com/syncthing/syncthing-android/releases/download/1.27.10/syncthing-arm64-1.27.10.apk',
        dungLuongBytes: BigInt(29360128),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 64000,
      },
    ],
  },

  // 16. BleachBit (Windows)
  {
    tenRepoDayDu: 'bleachbit/bleachbit',
    chuSoHuu: 'bleachbit',
    tenKhoChua: 'bleachbit',
    duongDanGithub: 'https://github.com/bleachbit/bleachbit',
    moTaGocTiengAnh: 'BleachBit cleans files to free up disk space and protect privacy',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/1500331?v=4',
    soSaoGithub: 3200,
    soLuotFork: 450,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'Python',
    danhSachChuDe: ['cleaner', 'privacy', 'security', 'disk-space'],
    danhMucChinh: 'Tiện ích hệ thống',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Dọn dẹp rác hệ thống và bảo vệ dấu vết riêng tư chuyên sâu',
    tomTatTinhNangVi:
      '• Giải phóng gigabyte dung lượng ổ đĩa từ cache ẩn\n• Xóa vĩnh viễn tệp tin ngăn chặn phục hồi (File Shredding)\n• Xóa sạch lịch sử duyệt web và cookie từ hàng chục trình duyệt',
    diemUyTin: 93,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v4.6.0',
    tieuDePhatHanh: 'BleachBit 4.6.0',
    files: [
      {
        tenTep: 'BleachBit-4.6.0-setup.exe',
        duongDanTaiVe: 'https://download.bleachbit.org/BleachBit-4.6.0-setup.exe',
        dungLuongBytes: BigInt(15728640),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 92000,
      },
    ],
  },

  // 17. DBeaver (Windows)
  {
    tenRepoDayDu: 'dbeaver/dbeaver',
    chuSoHuu: 'dbeaver',
    tenKhoChua: 'dbeaver',
    duongDanGithub: 'https://github.com/dbeaver/dbeaver',
    moTaGocTiengAnh: 'Free universal database tool and SQL client',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/1183204?v=4',
    soSaoGithub: 40000,
    soLuotFork: 3400,
    loaiGiayPhep: 'Apache-2.0',
    ngonNguChinh: 'Java',
    danhSachChuDe: ['database', 'sql', 'sql-client', 'developer-tools'],
    danhMucChinh: 'Lập trình & Phát triển',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: true,
    daXacMinh: true,
    khauHieuTiengViet: 'Phần mềm quản trị cơ sở dữ liệu và truy vấn SQL vạn năng',
    tomTatTinhNangVi:
      '• Kết nối mọi hệ CSDL: PostgreSQL, MySQL, SQLite, MongoDB, Redis\n• Trực quan hóa sơ đồ ERD tự động từ lược đồ dữ liệu\n• Trình soạn thảo SQL thông minh với gợi ý code tự động',
    diemUyTin: 97,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '24.2.0',
    tieuDePhatHanh: 'DBeaver 24.2.0',
    files: [
      {
        tenTep: 'dbeaver-ce-24.2.0-x86_64-setup.exe',
        duongDanTaiVe:
          'https://github.com/dbeaver/dbeaver/releases/download/24.2.0/dbeaver-ce-24.2.0-x86_64-setup.exe',
        dungLuongBytes: BigInt(119537664),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 260000,
      },
    ],
  },

  // 18. Audacity (Windows)
  {
    tenRepoDayDu: 'audacity/audacity',
    chuSoHuu: 'audacity',
    tenKhoChua: 'audacity',
    duongDanGithub: 'https://github.com/audacity/audacity',
    moTaGocTiengAnh: 'Major audio editor and recorder',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/104113?v=4',
    soSaoGithub: 12500,
    soLuotFork: 2400,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['audio', 'editor', 'recording', 'multimedia'],
    danhMucChinh: 'Đa phương tiện',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Phần mềm thu âm và biên tập âm thanh chuyên nghiệp',
    tomTatTinhNangVi:
      '• Thu âm giọng nói và nhạc cụ trực tiếp độ trễ thấp\n• Khử tạp âm và lọc tiếng ồn chuẩn xác\n• Cắt ghép nhạc đa kênh (multitrack) không giới hạn',
    diemUyTin: 94,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v3.6.4',
    tieuDePhatHanh: 'Audacity 3.6.4',
    files: [
      {
        tenTep: 'audacity-win-3.6.4-64bit.exe',
        duongDanTaiVe:
          'https://github.com/audacity/audacity/releases/download/Audacity-3.6.4/audacity-win-3.6.4-64bit.exe',
        dungLuongBytes: BigInt(37748736),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 175000,
      },
    ],
  },

  // 19. Transmission (Windows)
  {
    tenRepoDayDu: 'transmission/transmission',
    chuSoHuu: 'transmission',
    tenKhoChua: 'transmission',
    duongDanGithub: 'https://github.com/transmission/transmission',
    moTaGocTiengAnh: 'Official Transmission BitTorrent client repository',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/104113?v=4',
    soSaoGithub: 11000,
    soLuotFork: 1300,
    loaiGiayPhep: 'GPL-2.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['bittorrent', 'p2p', 'torrent', 'download-manager'],
    danhMucChinh: 'Mạng & Giao tiếp',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Phần mềm tải torrent nhanh, tối giản và không kèm bloatware',
    tomTatTinhNangVi:
      '• Tiêu tốn cực ít tài nguyên CPU và RAM\n• Mã hóa kết nối ngang hàng bảo vệ băng thông mạng\n• Quản lý và điều khiển từ xa qua giao diện web',
    diemUyTin: 96,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: '4.0.6',
    tieuDePhatHanh: 'Transmission 4.0.6',
    files: [
      {
        tenTep: 'transmission-4.0.6-x64.msi',
        duongDanTaiVe:
          'https://github.com/transmission/transmission/releases/download/4.0.6/transmission-4.0.6-x64.msi',
        dungLuongBytes: BigInt(25165824),
        dinhDangTep: DinhDangTep.MSI,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 115000,
      },
    ],
  },

  // 20. AnkiDroid (Android)
  {
    tenRepoDayDu: 'ankidroid/Anki-Android',
    chuSoHuu: 'ankidroid',
    tenKhoChua: 'Anki-Android',
    duongDanGithub: 'https://github.com/ankidroid/Anki-Android',
    moTaGocTiengAnh:
      'AnkiDroid: Anki flashcards on Android. Your secret weapon for memorizing anything',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/1547372?v=4',
    soSaoGithub: 7800,
    soLuotFork: 2200,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'Kotlin',
    danhSachChuDe: ['flashcards', 'learning', 'education', 'spaced-repetition'],
    danhMucChinh: 'Học tập & Giáo dục',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: true,
    daXacMinh: true,
    tenGoiAndroid: 'com.ichi2.anki',
    khauHieuTiengViet: 'Vũ khí ghi nhớ kiến thức vĩnh viễn bằng thuật toán lặp lại ngắt quãng',
    tomTatTinhNangVi:
      '• Tối ưu thời gian ôn tập từ vựng, kiến thức y khoa, lập trình\n• Hỗ trợ flashcard đa phương tiện: âm thanh, hình ảnh, toán học KaTeX\n• Đồng bộ đám mây liền mạch với máy tính và web',
    diemUyTin: 98,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v2.18.4',
    tieuDePhatHanh: 'AnkiDroid 2.18.4 Release',
    files: [
      {
        tenTep: 'AnkiDroid-2.18.4-arm64-v8a.apk',
        duongDanTaiVe:
          'https://github.com/ankidroid/Anki-Android/releases/download/v2.18.4/AnkiDroid-2.18.4-arm64-v8a.apk',
        dungLuongBytes: BigInt(28311552),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 195000,
      },
    ],
  },

  // 21. qBittorrent (Windows)
  {
    tenRepoDayDu: 'qbittorrent/qBittorrent',
    chuSoHuu: 'qbittorrent',
    tenKhoChua: 'qBittorrent',
    duongDanGithub: 'https://github.com/qbittorrent/qBittorrent',
    moTaGocTiengAnh: 'qBittorrent BitTorrent client',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/104113?v=4',
    soSaoGithub: 26000,
    soLuotFork: 3900,
    loaiGiayPhep: 'GPL-2.0',
    ngonNguChinh: 'C++',
    danhSachChuDe: ['torrent', 'p2p', 'bittorrent', 'download-manager'],
    danhMucChinh: 'Mạng & Giao tiếp',
    nenTangHoTro: NenTangHoTro.WINDOWS,
    duocNoiBat: false,
    daXacMinh: true,
    khauHieuTiengViet: 'Trình tải torrent mạnh mẽ, tích hợp công cụ tìm kiếm torrent',
    tomTatTinhNangVi:
      '• Tìm kiếm torrent trực tiếp trong ứng dụng qua plugin\n• Giới hạn băng thông thông minh theo thời gian trong ngày\n• Hoàn toàn không quảng cáo, mã nguồn mở 100%',
    diemUyTin: 97,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'release-4.6.5',
    tieuDePhatHanh: 'qBittorrent 4.6.5 release',
    files: [
      {
        tenTep: 'qbittorrent_4.6.5_x64_setup.exe',
        duongDanTaiVe:
          'https://github.com/qbittorrent/qBittorrent/releases/download/release-4.6.5/qbittorrent_4.6.5_x64_setup.exe',
        dungLuongBytes: BigInt(34603008),
        dinhDangTep: DinhDangTep.EXE,
        kienTrucChip: KienTrucChip.X86_64,
        soLuotTai: 380000,
      },
    ],
  },

  // 22. Jellyfin (Android)
  {
    tenRepoDayDu: 'jellyfin/jellyfin-android',
    chuSoHuu: 'jellyfin',
    tenKhoChua: 'jellyfin-android',
    duongDanGithub: 'https://github.com/jellyfin/jellyfin-android',
    moTaGocTiengAnh: 'Android Client for Jellyfin',
    duongDanIcon: 'https://avatars.githubusercontent.com/u/45698031?v=4',
    soSaoGithub: 3100,
    soLuotFork: 450,
    loaiGiayPhep: 'GPL-3.0',
    ngonNguChinh: 'Kotlin',
    danhSachChuDe: ['media-server', 'streaming', 'video', 'android'],
    danhMucChinh: 'Đa phương tiện',
    nenTangHoTro: NenTangHoTro.ANDROID,
    duocNoiBat: false,
    daXacMinh: true,
    tenGoiAndroid: 'org.jellyfin.mobile',
    khauHieuTiengViet: 'Xem phim và phát trực tuyến thư viện đa phương tiện gia đình',
    tomTatTinhNangVi:
      '• Kết nối tới máy chủ Jellyfin tự host của riêng bạn\n• Tương thích trình phát video ExoPlayer chất lượng cao\n• Không thu phí, không giới hạn tính năng truyền hình',
    diemUyTin: 95,
    mucDoAnToan: MucDoUyTin.AN_TOAN_CAO,
    tenPhienBan: 'v2.6.2',
    tieuDePhatHanh: 'Jellyfin Android 2.6.2',
    files: [
      {
        tenTep: 'jellyfin-android-v2.6.2-arm64-v8a.apk',
        duongDanTaiVe:
          'https://github.com/jellyfin/jellyfin-android/releases/download/v2.6.2/jellyfin-android-v2.6.2-arm64-v8a.apk',
        dungLuongBytes: BigInt(26214400),
        dinhDangTep: DinhDangTep.APK,
        kienTrucChip: KienTrucChip.ARM64_V8A,
        soLuotTai: 88000,
      },
    ],
  },
];

async function main() {
  console.info(
    `🌱 [ForgeStore Seed] Bắt đầu nạp dữ liệu cho ${SEED_APPS.length} ứng dụng tiêu biểu...`,
  );

  for (const app of SEED_APPS) {
    // 1. Upsert UngDung
    const createdApp = await prisma.ungDung.upsert({
      where: { tenRepoDayDu: app.tenRepoDayDu },
      update: {
        chuSoHuu: app.chuSoHuu,
        tenKhoChua: app.tenKhoChua,
        duongDanGithub: app.duongDanGithub,
        moTaGocTiengAnh: app.moTaGocTiengAnh,
        duongDanIcon: app.duongDanIcon,
        soSaoGithub: app.soSaoGithub,
        soLuotFork: app.soLuotFork,
        loaiGiayPhep: app.loaiGiayPhep,
        ngonNguChinh: app.ngonNguChinh,
        danhSachChuDe: app.danhSachChuDe,
        danhMucChinh: app.danhMucChinh,
        nenTangHoTro: app.nenTangHoTro,
        duocNoiBat: app.duocNoiBat,
        daXacMinh: app.daXacMinh,
        tenGoiAndroid: app.tenGoiAndroid || null,
        dongBoLanCuoi: new Date(),
      },
      create: {
        tenRepoDayDu: app.tenRepoDayDu,
        chuSoHuu: app.chuSoHuu,
        tenKhoChua: app.tenKhoChua,
        duongDanGithub: app.duongDanGithub,
        moTaGocTiengAnh: app.moTaGocTiengAnh,
        duongDanIcon: app.duongDanIcon,
        soSaoGithub: app.soSaoGithub,
        soLuotFork: app.soLuotFork,
        loaiGiayPhep: app.loaiGiayPhep,
        ngonNguChinh: app.ngonNguChinh,
        danhSachChuDe: app.danhSachChuDe,
        danhMucChinh: app.danhMucChinh,
        nenTangHoTro: app.nenTangHoTro,
        duocNoiBat: app.duocNoiBat,
        daXacMinh: app.daXacMinh,
        tenGoiAndroid: app.tenGoiAndroid || null,
        dongBoLanCuoi: new Date(),
      },
    });

    // 2. Upsert PhanTichAI
    await prisma.phanTichAI.upsert({
      where: { maUngDung: createdApp.maUngDung },
      update: {
        khauHieuTiengViet: app.khauHieuTiengViet,
        tomTatTinhNangVi: app.tomTatTinhNangVi,
        diemUyTin: app.diemUyTin,
        mucDoAnToan: app.mucDoAnToan,
        daThamDinhJev: true,
      },
      create: {
        maUngDung: createdApp.maUngDung,
        khauHieuTiengViet: app.khauHieuTiengViet,
        tomTatTinhNangVi: app.tomTatTinhNangVi,
        diemUyTin: app.diemUyTin,
        mucDoAnToan: app.mucDoAnToan,
        daThamDinhJev: true,
      },
    });

    // 3. Upsert BanPhatHanh
    const release = await prisma.banPhatHanh.upsert({
      where: {
        maUngDung_tenPhienBan: {
          maUngDung: createdApp.maUngDung,
          tenPhienBan: app.tenPhienBan,
        },
      },
      update: {
        tieuDePhatHanh: app.tieuDePhatHanh,
        laBanThuNghiem: false,
        ngayPhatHanh: new Date(),
      },
      create: {
        maUngDung: createdApp.maUngDung,
        tenPhienBan: app.tenPhienBan,
        tieuDePhatHanh: app.tieuDePhatHanh,
        laBanThuNghiem: false,
        ngayPhatHanh: new Date(),
      },
    });

    // 4. Xóa tệp cũ và tạo tệp cài đặt đính kèm
    await prisma.tepCaiDat.deleteMany({
      where: { maPhatHanh: release.maPhatHanh },
    });

    await prisma.tepCaiDat.createMany({
      data: app.files.map((f) => ({
        maPhatHanh: release.maPhatHanh,
        tenTep: f.tenTep,
        duongDanTaiVe: f.duongDanTaiVe,
        dungLuongBytes: f.dungLuongBytes,
        dinhDangTep: f.dinhDangTep,
        kienTrucChip: f.kienTrucChip,
        soLuotTai: f.soLuotTai,
      })),
    });

    console.info(`  ✓ Đã nạp: [${app.tenRepoDayDu}] (${app.nenTangHoTro} | ${app.danhMucChinh})`);
  }

  console.info(
    `✅ [ForgeStore Seed Hoàn Tất] Nạp thành công ${SEED_APPS.length} ứng dụng tiêu biểu!`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
