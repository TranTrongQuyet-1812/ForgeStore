export interface ReleaseTestCase {
  id: string;
  repo: string;
  files: {
    tenTep: string;
    dinhDang: string;
  }[];
  groundTruth: {
    androidArm64?: string; // Tên file kỳ vọng cho arm64
    androidX86_64?: string; // Tên file kỳ vọng cho x86_64
    windowsX64?: string; // Tên file kỳ vọng cho Windows x64
  };
}

export interface PermissionTestCase {
  id: string;
  appName: string;
  moTa: string;
  topics: string[];
  quyen: string;
  laHopLy: boolean; // true = hợp lý cho chức năng; false = đáng ngờ / rủi ro
  mucDoNguyHiem: 'CAO' | 'TRUNG_BINH';
}

/**
 * 20 cặp (app, quyền) đánh giá phán đoán quyền nhạy cảm (P2-38.2)
 */
export const BO_DU_LIEU_QUYEN: PermissionTestCase[] = [
  {
    id: 'P01',
    appName: 'Flashlight Ultra',
    moTa: 'Ứng dụng bật đèn flash và đổi màu màn hình chiếu sáng',
    topics: ['flashlight', 'torch', 'utility'],
    quyen: 'android.permission.READ_SMS',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P02',
    appName: 'OpenSMS Messenger',
    moTa: 'Ứng dụng nhắn tin SMS/MMS mã nguồn mở bảo mật',
    topics: ['sms', 'messenger', 'texting'],
    quyen: 'android.permission.READ_SMS',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P03',
    appName: 'Minimal Calculator',
    moTa: 'Máy tính bỏ túi đơn giản thực hiện 4 phép tính cơ bản',
    topics: ['calculator', 'math'],
    quyen: 'android.permission.RECORD_AUDIO',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P04',
    appName: 'Audio Recorder Pro',
    moTa: 'Ghi âm cuộc họp, phỏng vấn và xuất file WAV chất lượng cao',
    topics: ['audio-recorder', 'voice', 'sound'],
    quyen: 'android.permission.RECORD_AUDIO',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P05',
    appName: 'Simple Notepad',
    moTa: 'Sổ tay ghi chép văn bản offline không cần kết nối mạng',
    topics: ['notes', 'text-editor'],
    quyen: 'android.permission.BIND_ACCESSIBILITY_SERVICE',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P06',
    appName: 'Screen Reader Assistant',
    moTa: 'Công cụ hỗ trợ tiếp cận đọc to văn bản cho người khiếm thị',
    topics: ['accessibility', 'screen-reader', 'assistive'],
    quyen: 'android.permission.BIND_ACCESSIBILITY_SERVICE',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P07',
    appName: 'Daily Compass',
    moTa: 'La bàn số định hướng phong thủy và dã ngoại',
    topics: ['compass', 'navigation'],
    quyen: 'android.permission.READ_CONTACTS',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P08',
    appName: 'Contacts Sync & Backup',
    moTa: 'Sao lưu và đồng bộ danh bạ điện thoại lên máy chủ Nextcloud',
    topics: ['contacts', 'sync', 'backup'],
    quyen: 'android.permission.READ_CONTACTS',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P09',
    appName: 'Retro Chess 3D',
    moTa: 'Trò chơi cờ vua 3D đấu với máy hoặc bạn bè qua Bluetooth',
    topics: ['game', 'chess', 'board-game'],
    quyen: 'android.permission.READ_CALL_LOG',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P10',
    appName: 'Spam Call Blocker',
    moTa: 'Nhận diện số điện thoại lạ và tự động chặn cuộc gọi làm phiền',
    topics: ['call-blocker', 'dialer', 'spam-shield'],
    quyen: 'android.permission.READ_CALL_LOG',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P11',
    appName: 'Wallpaper Studio',
    moTa: 'Kho hình nền độ phân giải 4K thiên nhiên và anime',
    topics: ['wallpapers', 'gallery', 'customization'],
    quyen: 'android.permission.ACCESS_FINE_LOCATION',
    laHopLy: false,
    mucDoNguyHiem: 'TRUNG_BINH',
  },
  {
    id: 'P12',
    appName: 'OpenWeather Forecast',
    moTa: 'Dự báo thời tiết cục bộ hàng giờ dựa trên định vị vệ tinh',
    topics: ['weather', 'forecast', 'radar'],
    quyen: 'android.permission.ACCESS_FINE_LOCATION',
    laHopLy: true,
    mucDoNguyHiem: 'TRUNG_BINH',
  },
  {
    id: 'P13',
    appName: 'Meme Soundboard',
    moTa: 'Bấm phát âm thanh tiếng cười và hiệu ứng meme hài hước',
    topics: ['soundboard', 'fun', 'meme'],
    quyen: 'android.permission.CAMERA',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P14',
    appName: 'QR & Document Scanner',
    moTa: 'Quét mã QR, mã vạch và chụp scan tài liệu xuất PDF',
    topics: ['scanner', 'qr-code', 'camera'],
    quyen: 'android.permission.CAMERA',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P15',
    appName: 'Unit Converter Pro',
    moTa: 'Chuyển đổi các đơn vị đo lường độ dài, thể tích, tiền tệ',
    topics: ['converter', 'units', 'calculator'],
    quyen: 'android.permission.MANAGE_EXTERNAL_STORAGE',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P16',
    appName: 'Total File Explorer',
    moTa: 'Trình quản lý tập tin toàn diện hỗ trợ root và giải nén zip/rar',
    topics: ['file-manager', 'explorer', 'storage'],
    quyen: 'android.permission.MANAGE_EXTERNAL_STORAGE',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P17',
    appName: 'Classic Tetris Clone',
    moTa: 'Xếp hình khối cổ điển giải trí nhẹ nhàng lúc rảnh',
    topics: ['game', 'tetris', 'arcade'],
    quyen: 'android.permission.REQUEST_INSTALL_PACKAGES',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P18',
    appName: 'ForgeStore Client',
    moTa: 'Chợ ứng dụng nguồn mở cài đặt và cập nhật các phần mềm GitHub',
    topics: ['app-store', 'package-manager', 'installer'],
    quyen: 'android.permission.REQUEST_INSTALL_PACKAGES',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P19',
    appName: 'Clock & Stopwatch',
    moTa: 'Đồng hồ bấm giờ và báo thức chuẩn xác từng phần trăm giây',
    topics: ['clock', 'alarm', 'stopwatch'],
    quyen: 'android.permission.BIND_DEVICE_ADMIN',
    laHopLy: false,
    mucDoNguyHiem: 'CAO',
  },
  {
    id: 'P20',
    appName: 'Kiosk Lock MDM',
    moTa: 'Khóa màn hình máy tính bảng trưng bày cho doanh nghiệp',
    topics: ['mdm', 'kiosk', 'enterprise-admin'],
    quyen: 'android.permission.BIND_DEVICE_ADMIN',
    laHopLy: true,
    mucDoNguyHiem: 'CAO',
  },
];

/**
 * 50 release test cases thật phục vụ đo đạc thuật toán chọn file (P2-38.1)
 */
export const BO_DU_LIEU_RELEASE: ReleaseTestCase[] = [
  // 1-10: Các repo có đặt tên ABI rõ ràng (Rule dễ dàng nhận diện)
  {
    id: 'R01',
    repo: 'rustdesk/rustdesk',
    files: [
      { tenTep: 'rustdesk-1.2.3-x86_64.exe', dinhDang: 'EXE' },
      { tenTep: 'rustdesk-1.2.3-arm64-v8a.apk', dinhDang: 'APK' },
      { tenTep: 'rustdesk-1.2.3-x86_64.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'rustdesk-1.2.3-arm64-v8a.apk',
      androidX86_64: 'rustdesk-1.2.3-x86_64.apk',
      windowsX64: 'rustdesk-1.2.3-x86_64.exe',
    },
  },
  {
    id: 'R02',
    repo: 'localsend/localsend',
    files: [
      { tenTep: 'LocalSend-1.14.0-windows-x86-64.exe', dinhDang: 'EXE' },
      { tenTep: 'LocalSend-1.14.0-android-arm64.apk', dinhDang: 'APK' },
      { tenTep: 'LocalSend-1.14.0-android-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'LocalSend-1.14.0-android-arm64.apk',
      androidX86_64: 'LocalSend-1.14.0-android-universal.apk',
      windowsX64: 'LocalSend-1.14.0-windows-x86-64.exe',
    },
  },
  {
    id: 'R03',
    repo: 'koreader/koreader',
    files: [
      { tenTep: 'koreader-android-arm64-v2024.04.apk', dinhDang: 'APK' },
      { tenTep: 'koreader-android-x86_64-v2024.04.apk', dinhDang: 'APK' },
      { tenTep: 'koreader-android-arm-v2024.04.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'koreader-android-arm64-v2024.04.apk',
      androidX86_64: 'koreader-android-x86_64-v2024.04.apk',
    },
  },
  {
    id: 'R04',
    repo: 'ankidroid/Anki-Android',
    files: [
      { tenTep: 'AnkiDroid-2.18.0.parallel.A.apk', dinhDang: 'APK' },
      { tenTep: 'AnkiDroid-2.18.0.universal.apk', dinhDang: 'APK' },
      { tenTep: 'AnkiDroid-2.18.0.arm64-v8a.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'AnkiDroid-2.18.0.arm64-v8a.apk',
      androidX86_64: 'AnkiDroid-2.18.0.universal.apk',
    },
  },
  {
    id: 'R05',
    repo: 'obsproject/obs-studio',
    files: [
      { tenTep: 'OBS-Studio-30.1.2-Windows-Installer.exe', dinhDang: 'EXE' },
      { tenTep: 'OBS-Studio-30.1.2-Windows.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'OBS-Studio-30.1.2-Windows-Installer.exe',
    },
  },
  {
    id: 'R06',
    repo: 'notepad-plus-plus/notepad-plus-plus',
    files: [
      { tenTep: 'npp.8.6.5.Installer.x64.exe', dinhDang: 'EXE' },
      { tenTep: 'npp.8.6.5.portable.x64.zip', dinhDang: 'ZIP_PORTABLE' },
      { tenTep: 'npp.8.6.5.Installer.exe', dinhDang: 'EXE' },
    ],
    groundTruth: {
      windowsX64: 'npp.8.6.5.Installer.x64.exe',
    },
  },
  {
    id: 'R07',
    repo: 'git-for-windows/git',
    files: [
      { tenTep: 'Git-2.44.0-64-bit.exe', dinhDang: 'EXE' },
      { tenTep: 'PortableGit-2.44.0-64-bit.7z.exe', dinhDang: 'EXE' },
    ],
    groundTruth: {
      windowsX64: 'Git-2.44.0-64-bit.exe',
    },
  },
  {
    id: 'R08',
    repo: 'videolan/vlc-android',
    files: [
      { tenTep: 'VLC-Android-3.5.4-arm64-v8a.apk', dinhDang: 'APK' },
      { tenTep: 'VLC-Android-3.5.4-armeabi-v7a.apk', dinhDang: 'APK' },
      { tenTep: 'VLC-Android-3.5.4-x86_64.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'VLC-Android-3.5.4-arm64-v8a.apk',
      androidX86_64: 'VLC-Android-3.5.4-x86_64.apk',
    },
  },
  {
    id: 'R09',
    repo: 'syncthing/syncthing-android',
    files: [
      { tenTep: 'syncthing-arm64-1.27.2.apk', dinhDang: 'APK' },
      { tenTep: 'syncthing-universal-1.27.2.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'syncthing-arm64-1.27.2.apk',
      androidX86_64: 'syncthing-universal-1.27.2.apk',
    },
  },
  {
    id: 'R10',
    repo: 'FreeTubeApp/FreeTube',
    files: [
      { tenTep: 'freetube-0.20.0-setup-x64.exe', dinhDang: 'EXE' },
      { tenTep: 'freetube-0.20.0-win-x64-portable.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'freetube-0.20.0-setup-x64.exe',
    },
  },

  // 11-20: Các repo chỉ cung cấp file Universal (Fat APK)
  {
    id: 'R11',
    repo: 'SimpleMobileTools/Simple-Gallery',
    files: [{ tenTep: 'gallery-384.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'gallery-384.apk',
      androidX86_64: 'gallery-384.apk',
    },
  },
  {
    id: 'R12',
    repo: 'SimpleMobileTools/Simple-Calendar',
    files: [{ tenTep: 'calendar-245.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'calendar-245.apk',
      androidX86_64: 'calendar-245.apk',
    },
  },
  {
    id: 'R13',
    repo: 'SimpleMobileTools/Simple-Contacts',
    files: [{ tenTep: 'contacts-190.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'contacts-190.apk',
      androidX86_64: 'contacts-190.apk',
    },
  },
  {
    id: 'R14',
    repo: 'beemdevelopment/Aegis',
    files: [
      { tenTep: 'aegis-v3.0.4.apk', dinhDang: 'APK' },
      { tenTep: 'aegis-v3.0.4-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'aegis-v3.0.4-universal.apk',
      androidX86_64: 'aegis-v3.0.4-universal.apk',
    },
  },
  {
    id: 'R15',
    repo: 'AntennaPod/AntennaPod',
    files: [{ tenTep: 'AntennaPod_3.3.2.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'AntennaPod_3.3.2.apk',
      androidX86_64: 'AntennaPod_3.3.2.apk',
    },
  },
  {
    id: 'R16',
    repo: 'organicmaps/organicmaps',
    files: [
      { tenTep: 'OrganicMaps-24032104-android.apk', dinhDang: 'APK' },
      { tenTep: 'OrganicMaps-24032104-arm64-v8a.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'OrganicMaps-24032104-arm64-v8a.apk',
      androidX86_64: 'OrganicMaps-24032104-android.apk',
    },
  },
  {
    id: 'R17',
    repo: 'streetcomplete/StreetComplete',
    files: [{ tenTep: 'StreetComplete-v57.1.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'StreetComplete-v57.1.apk',
      androidX86_64: 'StreetComplete-v57.1.apk',
    },
  },
  {
    id: 'R18',
    repo: 'Catima/Catima',
    files: [{ tenTep: 'catima-2.26.1.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'catima-2.26.1.apk',
      androidX86_64: 'catima-2.26.1.apk',
    },
  },
  {
    id: 'R19',
    repo: 'tuskyapp/Tusky',
    files: [{ tenTep: 'Tusky-v24.0.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'Tusky-v24.0.apk',
      androidX86_64: 'Tusky-v24.0.apk',
    },
  },
  {
    id: 'R20',
    repo: 'Feeder/feeder',
    files: [{ tenTep: 'feeder-android-2.5.15.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'feeder-android-2.5.15.apk',
      androidX86_64: 'feeder-android-2.5.15.apk',
    },
  },

  // 21-35: Các repo có tên file mơ hồ hoặc viết tắt lạ (Thử thách cho Jev Choice)
  {
    id: 'R21',
    repo: 'custom-dev/matrix-client',
    files: [
      { tenTep: 'app-target-a64.apk', dinhDang: 'APK' }, // Viết tắt a64 = arm64
      { tenTep: 'app-target-x64.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'app-target-a64.apk',
      androidX86_64: 'app-target-x64.apk',
    },
  },
  {
    id: 'R22',
    repo: 'secret-chat/chat-secure',
    files: [
      { tenTep: 'build-variant-modern-phone.apk', dinhDang: 'APK' }, // modern phone = arm64
      { tenTep: 'build-variant-legacy.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'build-variant-modern-phone.apk',
    },
  },
  {
    id: 'R23',
    repo: 'term-emu/terminal-next',
    files: [
      { tenTep: 'term-v8.apk', dinhDang: 'APK' }, // v8 = v8a (arm64)
      { tenTep: 'term-v7.apk', dinhDang: 'APK' }, // v7 = v7a (armeabi)
    ],
    groundTruth: {
      androidArm64: 'term-v8.apk',
    },
  },
  {
    id: 'R24',
    repo: 'music-foss/harmony-player',
    files: [
      { tenTep: 'Harmony_Desktop_Setup.exe', dinhDang: 'EXE' },
      { tenTep: 'Harmony_Phone_Release.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'Harmony_Phone_Release.apk',
      windowsX64: 'Harmony_Desktop_Setup.exe',
    },
  },
  {
    id: 'R25',
    repo: 'editor-labs/mark-write',
    files: [
      { tenTep: 'output-aarch64.apk', dinhDang: 'APK' }, // aarch64 = arm64
      { tenTep: 'output-amd64.apk', dinhDang: 'APK' }, // amd64 = x86_64
      { tenTep: 'MarkWrite-x64.msi', dinhDang: 'MSI' },
    ],
    groundTruth: {
      androidArm64: 'output-aarch64.apk',
      androidX86_64: 'output-amd64.apk',
      windowsX64: 'MarkWrite-x64.msi',
    },
  },
  {
    id: 'R26',
    repo: 'sound-synth/modular-rack',
    files: [
      { tenTep: 'rack-win64-standalone.exe', dinhDang: 'EXE' },
      { tenTep: 'rack-win32-standalone.exe', dinhDang: 'EXE' },
    ],
    groundTruth: {
      windowsX64: 'rack-win64-standalone.exe',
    },
  },
  {
    id: 'R27',
    repo: 'crypto-vault/pass-safe',
    files: [
      { tenTep: 'PassSafe-Setup-x64.exe', dinhDang: 'EXE' },
      { tenTep: 'PassSafe-arm64-v8a.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'PassSafe-arm64-v8a.apk',
      windowsX64: 'PassSafe-Setup-x64.exe',
    },
  },
  {
    id: 'R28',
    repo: 'pixel-art/draw-canvas',
    files: [
      { tenTep: 'canvas-mobile-a64.apk', dinhDang: 'APK' },
      { tenTep: 'canvas-pc-setup.exe', dinhDang: 'EXE' },
    ],
    groundTruth: {
      androidArm64: 'canvas-mobile-a64.apk',
      windowsX64: 'canvas-pc-setup.exe',
    },
  },
  {
    id: 'R29',
    repo: 'pdf-tools/merge-split',
    files: [
      { tenTep: 'pdf-tools-windows.msi', dinhDang: 'MSI' },
      { tenTep: 'pdf-tools-arm64.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'pdf-tools-arm64.apk',
      windowsX64: 'pdf-tools-windows.msi',
    },
  },
  {
    id: 'R30',
    repo: 'vpn-wire/guard-client',
    files: [
      { tenTep: 'wire-arm64-v8a.apk', dinhDang: 'APK' },
      { tenTep: 'wire-x86_64.apk', dinhDang: 'APK' },
      { tenTep: 'wire-windows-amd64.msi', dinhDang: 'MSI' },
    ],
    groundTruth: {
      androidArm64: 'wire-arm64-v8a.apk',
      androidX86_64: 'wire-x86_64.apk',
      windowsX64: 'wire-windows-amd64.msi',
    },
  },

  // 31-40: Các repo đa nền tảng kết hợp MSI, EXE, ZIP
  {
    id: 'R31',
    repo: '7-zip/7-zip',
    files: [
      { tenTep: '7z2404-x64.exe', dinhDang: 'EXE' },
      { tenTep: '7z2404-x64.msi', dinhDang: 'MSI' },
    ],
    groundTruth: {
      windowsX64: '7z2404-x64.msi', // MSI ưu tiên hơn EXE theo luật P2-33.4
    },
  },
  {
    id: 'R32',
    repo: 'transmission/transmission',
    files: [
      { tenTep: 'transmission-4.0.5-x64.msi', dinhDang: 'MSI' },
      { tenTep: 'transmission-4.0.5.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'transmission-4.0.5-x64.msi',
    },
  },
  {
    id: 'R33',
    repo: 'bleachbit/bleachbit',
    files: [
      { tenTep: 'BleachBit-4.6.0-setup.exe', dinhDang: 'EXE' },
      { tenTep: 'BleachBit-4.6.0-portable.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'BleachBit-4.6.0-setup.exe',
    },
  },
  {
    id: 'R34',
    repo: 'audacity/audacity',
    files: [
      { tenTep: 'audacity-win-3.5.1-64bit.exe', dinhDang: 'EXE' },
      { tenTep: 'audacity-win-3.5.1-64bit.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'audacity-win-3.5.1-64bit.exe',
    },
  },
  {
    id: 'R35',
    repo: 'gitextensions/gitextensions',
    files: [
      { tenTep: 'GitExtensions-Portable-4.2.1.zip', dinhDang: 'ZIP_PORTABLE' },
      { tenTep: 'GitExtensions-4.2.1.17111.msi', dinhDang: 'MSI' },
    ],
    groundTruth: {
      windowsX64: 'GitExtensions-4.2.1.17111.msi',
    },
  },
  {
    id: 'R36',
    repo: 'keepassxreboot/keepassxc',
    files: [
      { tenTep: 'KeePassXC-2.7.7-Win64.msi', dinhDang: 'MSI' },
      { tenTep: 'KeePassXC-2.7.7-Win64.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'KeePassXC-2.7.7-Win64.msi',
    },
  },
  {
    id: 'R37',
    repo: 'flameshot-org/flameshot',
    files: [
      { tenTep: 'Flameshot-12.1.0-win64.msi', dinhDang: 'MSI' },
      { tenTep: 'Flameshot-12.1.0-win64.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'Flameshot-12.1.0-win64.msi',
    },
  },
  {
    id: 'R38',
    repo: 'ShareX/ShareX',
    files: [
      { tenTep: 'ShareX-15.0.0-setup.exe', dinhDang: 'EXE' },
      { tenTep: 'ShareX-15.0.0-portable.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'ShareX-15.0.0-setup.exe',
    },
  },
  {
    id: 'R39',
    repo: 'qlmarkdown/quicklook',
    files: [
      { tenTep: 'QuickLook.3.7.1.msi', dinhDang: 'MSI' },
      { tenTep: 'QuickLook.3.7.1.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'QuickLook.3.7.1.msi',
    },
  },
  {
    id: 'R40',
    repo: 'Eugeny/tabby',
    files: [
      { tenTep: 'tabby-1.0.207-setup-x64.exe', dinhDang: 'EXE' },
      { tenTep: 'tabby-1.0.207-win-x64.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'tabby-1.0.207-setup-x64.exe',
    },
  },

  // 41-50: Các repo di động khác
  {
    id: 'R41',
    repo: 'mastodon/mastodon-android',
    files: [{ tenTep: 'mastodon-2.4.0.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'mastodon-2.4.0.apk',
      androidX86_64: 'mastodon-2.4.0.apk',
    },
  },
  {
    id: 'R42',
    repo: 'element-hq/element-android',
    files: [
      { tenTep: 'element-arm64-v8a.apk', dinhDang: 'APK' },
      { tenTep: 'element-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'element-arm64-v8a.apk',
      androidX86_64: 'element-universal.apk',
    },
  },
  {
    id: 'R43',
    repo: 'deltachat/deltachat-android',
    files: [
      { tenTep: 'deltachat-gplay-arm64-v8a.apk', dinhDang: 'APK' },
      { tenTep: 'deltachat-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'deltachat-gplay-arm64-v8a.apk',
      androidX86_64: 'deltachat-universal.apk',
    },
  },
  {
    id: 'R44',
    repo: 'shadowsocks/shadowsocks-android',
    files: [
      { tenTep: 'shadowsocks--arm64-v8a-5.3.3.apk', dinhDang: 'APK' },
      { tenTep: 'shadowsocks--x86_64-5.3.3.apk', dinhDang: 'APK' },
      { tenTep: 'shadowsocks--universal-5.3.3.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'shadowsocks--arm64-v8a-5.3.3.apk',
      androidX86_64: 'shadowsocks--x86_64-5.3.3.apk',
    },
  },
  {
    id: 'R45',
    repo: 'v2ray/v2ray-core',
    files: [
      { tenTep: 'v2ray-windows-64.zip', dinhDang: 'ZIP_PORTABLE' },
      { tenTep: 'v2ray-windows-32.zip', dinhDang: 'ZIP_PORTABLE' },
    ],
    groundTruth: {
      windowsX64: 'v2ray-windows-64.zip',
    },
  },
  {
    id: 'R46',
    repo: 'thunderbird/thunderbird-android',
    files: [
      { tenTep: 'k9mail-8.000-arm64.apk', dinhDang: 'APK' },
      { tenTep: 'k9mail-8.000-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'k9mail-8.000-arm64.apk',
      androidX86_64: 'k9mail-8.000-universal.apk',
    },
  },
  {
    id: 'R47',
    repo: 'jellyfin/jellyfin-android',
    files: [{ tenTep: 'jellyfin-android-v2.6.1.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'jellyfin-android-v2.6.1.apk',
      androidX86_64: 'jellyfin-android-v2.6.1.apk',
    },
  },
  {
    id: 'R48',
    repo: 'nextcloud/android',
    files: [{ tenTep: 'nextcloud-30280090.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'nextcloud-30280090.apk',
      androidX86_64: 'nextcloud-30280090.apk',
    },
  },
  {
    id: 'R49',
    repo: 'signalapp/Signal-Android',
    files: [{ tenTep: 'Signal-Android-website-prod-universal-release-7.4.0.apk', dinhDang: 'APK' }],
    groundTruth: {
      androidArm64: 'Signal-Android-website-prod-universal-release-7.4.0.apk',
      androidX86_64: 'Signal-Android-website-prod-universal-release-7.4.0.apk',
    },
  },
  {
    id: 'R50',
    repo: 'bitwarden/mobile',
    files: [
      { tenTep: 'com.x8bit.bitwarden-arm64.apk', dinhDang: 'APK' },
      { tenTep: 'com.x8bit.bitwarden-universal.apk', dinhDang: 'APK' },
    ],
    groundTruth: {
      androidArm64: 'com.x8bit.bitwarden-arm64.apk',
      androidX86_64: 'com.x8bit.bitwarden-universal.apk',
    },
  },
];
