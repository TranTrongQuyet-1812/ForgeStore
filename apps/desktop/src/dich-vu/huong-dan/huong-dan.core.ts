/**
 * Logic thuần cho hướng dẫn nhanh 2 chặng (driver.js) và liên kết tài liệu CLI trên Web Landing (P3B-46).
 * Tách khỏi UI để dễ kiểm thử đơn vị và đồng bộ 100% các neo mục với trang `/huong-dan-cli` (P5-04).
 */

export const KHOA_DA_XEM_HUONG_DAN_LAN_DAU = 'forgestore_da_xem_huong_dan_lan_dau';

/** Kho mã mẫu chuẩn để giới thiệu Trang Chi tiết ở Chặng 2 (105,5k sao, 100/100 uy tín, đủ bản cài Windows và CLI). */
export const REPO_MAU_HUONG_DAN = 'microsoft/terminal';

export const URL_HUONG_DAN_CLI_GOC = 'https://forgestore.lhutech.click/huong-dan-cli';
export const URL_HUONG_DAN_GITHUB = 'https://forgestore.lhutech.click/huong-dan-cli#github-la-gi';

/** Ánh xạ mã công cụ CLI sang đúng neo `id` trên trang `/huong-dan-cli` (P5-04). */
export const BAN_DO_NEO_HUONG_DAN_CLI: Record<string, string> = {
  docker: 'docker',
  npm: 'npm',
  npx: 'npx',
  pip: 'pip',
  winget: 'winget',
  scoop: 'scoop',
  cargo: 'cargo',
  conda: 'conda',
  go: 'go',
};

export interface BuocHuongDanNhanh {
  /** Bộ chọn CSS ổn định theo thuộc tính `data-tour`. */
  readonly element: string;
  readonly tieuDe: string;
  readonly moTa: string;
  readonly phia?: 'top' | 'right' | 'bottom' | 'left';
  readonly canLe?: 'start' | 'center' | 'end';
}

/** Chặng 1 (4 bước): Giới thiệu nhanh trên màn hình Khám phá và thanh điều hướng. */
export const CAC_BUOC_HUONG_DAN_KHAM_PHA: readonly BuocHuongDanNhanh[] = [
  {
    element: '[data-tour="tim-kiem"]',
    tieuDe: 'Tìm ứng dụng & dán link GitHub',
    moTa: 'Nhấn Ctrl+K để gõ tên phần mềm hoặc mô tả nhu cầu bằng tiếng Việt, và có thể dán thẳng đường dẫn kho mã GitHub (ví dụ https://github.com/localsend/localsend) để ForgeStore tự kiểm tra độ an toàn và tải cài đặt.',
    phia: 'bottom',
    canLe: 'center',
  },
  {
    element: '[data-tour="kham-pha"]',
    tieuDe: 'Khám phá & Danh mục',
    moTa: 'Duyệt hàng nghìn ứng dụng mã nguồn mở cho Windows đã dịch mô tả tiếng Việt, phân theo 9 danh mục và chấm điểm uy tín minh bạch.',
    phia: 'right',
  },
  {
    element: '[data-tour="bo-suu-tap"]',
    tieuDe: 'Thư viện máy & Kho yêu thích',
    moTa: 'Theo dõi toàn bộ ứng dụng đã cài trên máy (cả bộ cài Windows lẫn ứng dụng dòng lệnh), nhận báo bản mới, gỡ cài đặt gọn gàng và đồng bộ Kho yêu thích khi đăng nhập.',
    phia: 'right',
  },
  {
    element: '[data-tour="cai-dat"]',
    tieuDe: 'Cài đặt hệ thống',
    moTa: 'Đổi giao diện Sáng/Tối, chọn Terminal mặc định, dọn tệp tải về và kiểm tra cập nhật ForgeStore. Bấm Tiếp tục để xem nhanh cách đọc và cài một ứng dụng mẫu (Windows Terminal).',
    phia: 'right',
  },
];

/** Chặng 2 (5 bước): Hướng dẫn đọc README, bản phát hành, lệnh CLI và cài đặt trên trang `microsoft/terminal`. */
export const CAC_BUOC_HUONG_DAN_CHI_TIET: readonly BuocHuongDanNhanh[] = [
  {
    element: '[data-tour="tro-giup"]',
    tieuDe: 'Trợ giúp & Tài liệu hướng dẫn',
    moTa: 'Bấm biểu tượng dấu chấm hỏi (?) này bất cứ lúc nào để đọc GitHub & Repo là gì, mở lại hướng dẫn nhanh và đặc biệt hãy đọc kỹ tài liệu hướng dẫn cài đặt dòng lệnh (CLI) trước khi cài ứng dụng dòng lệnh.',
    phia: 'bottom',
    canLe: 'end',
  },
  {
    element: '[data-tour="chi-tiet-readme"]',
    tieuDe: 'Đọc kỹ README trước khi cài',
    moTa: 'Tài liệu gốc của tác giả đã được dịch sang tiếng Việt (bạn có thể chuyển qua lại giữa Tiếng Việt và Bản gốc). Luôn đọc kỹ README trước khi cài bất kỳ Repo nào để nắm yêu cầu và cách dùng.',
    phia: 'top',
  },
  {
    element: '[data-tour="chi-tiet-phat-hanh"]',
    tieuDe: 'Các bản phát hành & Chọn tệp cài đặt',
    moTa: 'Xem danh sách tệp cài đặt Windows (.exe, .msi, bản chạy ngay .zip/.7z kèm xác minh tệp gốc) và chọn phiên bản phát hành phù hợp theo nhu cầu của bạn.',
    phia: 'top',
  },
  {
    element: '[data-tour="chi-tiet-cli"]',
    tieuDe: 'Hướng dẫn cài đặt qua dòng lệnh (CLI)',
    moTa: 'Các câu lệnh được trích xuất nguyên văn từ README (WinGet, Scoop, npm, Docker, pip…). Bấm Mở Terminal để ForgeStore điền sẵn lệnh vào PowerShell cho bạn tự kiểm tra rồi nhấn Enter, tuyệt đối không tự chạy ngầm.',
    phia: 'top',
  },
  {
    element: '[data-tour="chi-tiet-cai-dat"]',
    tieuDe: 'Tùy chọn tải về & Cài đặt nhanh',
    moTa: 'Chọn loại bộ cài hoặc bản chạy ngay rồi bấm tải/cài đặt nhanh 1 chạm tại đây — ngay bên dưới là Điểm uy tín kho mã chấm minh bạch theo bộ luật công khai.',
    phia: 'left',
  },
];

/**
 * Ánh xạ mã công cụ CLI sang đường dẫn tài liệu có neo đúng mục trên Web Landing.
 * Nếu không khớp mã công cụ đã biết thì trả về trang hướng dẫn gốc để tránh liên kết gãy.
 */
export function layLienKetHuongDanCli(maCongCu?: string | null): string {
  if (!maCongCu) return URL_HUONG_DAN_CLI_GOC;
  const maChuan = maCongCu.trim().toLowerCase();
  const neo = BAN_DO_NEO_HUONG_DAN_CLI[maChuan];
  return neo ? `${URL_HUONG_DAN_CLI_GOC}#${neo}` : URL_HUONG_DAN_CLI_GOC;
}

function layBoNhoMacDinh(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Kiểm tra người dùng đã xem hoặc bỏ qua hướng dẫn nhanh lần đầu hay chưa. */
export function daXemHuongDanLanDau(boNho?: Pick<Storage, 'getItem'> | null): boolean {
  const khoLuu = boNho === undefined ? layBoNhoMacDinh() : boNho;
  if (!khoLuu) return false;
  try {
    return khoLuu.getItem(KHOA_DA_XEM_HUONG_DAN_LAN_DAU) === '1';
  } catch {
    return false;
  }
}

/** Ghi cờ đã xem hướng dẫn lần đầu để các lần mở ForgeStore sau không tự bật lại. */
export function danhDauDaXemHuongDanLanDau(boNho?: Pick<Storage, 'setItem'> | null): void {
  const khoLuu = boNho === undefined ? layBoNhoMacDinh() : boNho;
  if (!khoLuu) return;
  try {
    khoLuu.setItem(KHOA_DA_XEM_HUONG_DAN_LAN_DAU, '1');
  } catch {
    // Bỏ qua an toàn nếu trình duyệt/webview chặn ghi localStorage
  }
}
