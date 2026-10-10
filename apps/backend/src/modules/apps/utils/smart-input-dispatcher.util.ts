/**
 * Utility Phân luồng Nhập liệu Thông minh (Smart Input Dispatcher) - P2-40
 * Tự động phân loại câu nhập của người dùng thành 3 luồng:
 * 1. URL: Liên kết kho GitHub (chuyển sang luồng Paste & Play - P2-41)
 * 2. TEN_APP: Tên ứng dụng ngắn gọn (tìm kiếm trực tiếp trong CSDL Store)
 * 3. Y_DINH: Câu mô tả nhu cầu tự nhiên bằng tiếng Việt (kích hoạt Gemini & pgvector - P2-42 & P2-36)
 */

export type LoaiTruyVanTimKiem = 'URL' | 'TEN_APP' | 'Y_DINH';

export interface KetQuaPhanLuongTruyVan {
  loai: LoaiTruyVanTimKiem;
  tuKhoa: string;
  owner?: string;
  repo?: string;
}

// Regex an toàn nhận diện các định dạng URL GitHub
// Hỗ trợ: https://, http://, www., .git, /releases, /tree, ?query, #hash, trailing slash
const GITHUB_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/.*|\?.*|#.*)?$/i;

// Danh sách các tiền tố/từ ngữ đặc trưng của câu mô tả ý định tiếng Việt
const TIEN_TO_Y_DINH = [
  'app',
  'ung dung',
  'ứng dụng',
  'phan mem',
  'phần mềm',
  'trinh',
  'trình',
  'cong cu',
  'công cụ',
  'tim',
  'tìm',
  'can',
  'cần',
  'muon',
  'muốn',
  'cho toi',
  'cho tôi',
  'cach',
  'cách',
  'lam sao',
  'làm sao',
];

/**
 * Hàm thuần phân luồng câu truy vấn của người dùng (P2-40.1).
 * Không có side-effect, dễ dàng kiểm thử đơn vị độc lập.
 */
export function phanLuongInput(q: string): KetQuaPhanLuongTruyVan {
  if (!q || typeof q !== 'string') {
    return { loai: 'TEN_APP', tuKhoa: '' };
  }

  // Cắt tối đa 200 ký tự theo quy định P2-40.6
  const cleanInput = q.trim().slice(0, 200);
  if (!cleanInput) {
    return { loai: 'TEN_APP', tuKhoa: '' };
  }

  // 1. LUỒNG URL: Kiểm tra xem có phải liên kết GitHub hay không (P2-40.2)
  const matchUrl = cleanInput.match(GITHUB_URL_REGEX);
  if (matchUrl && matchUrl[1] && matchUrl[2]) {
    const owner = matchUrl[1];
    let repo = matchUrl[2];
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    return {
      loai: 'URL',
      tuKhoa: cleanInput,
      owner,
      repo,
    };
  }

  // 2. Tách từ để phân định giữa TÊN_APP và Ý_ĐỊNH
  const words = cleanInput.split(/\s+/).filter(Boolean);
  const lowerInput = cleanInput.toLowerCase();

  // Kiểm tra dấu câu phức tạp đặc trưng của câu diễn đạt hoặc câu hỏi: ?, !, ;, :, ", ', ...
  const coDauCauPhucTap = /[?!;:"~<>(){}[\]/\\]/.test(cleanInput);

  // Kiểm tra có chứa tiền tố mô tả ý định không
  const batDauBangTienToYDinh = TIEN_TO_Y_DINH.some(
    (prefix) => lowerInput.startsWith(prefix + ' ') || lowerInput === prefix,
  );

  // Nếu câu ngắn (<= 3 từ), không có dấu câu phức tạp và không mở đầu bằng tiền tố mô tả ý định
  if (words.length <= 3 && !coDauCauPhucTap && !batDauBangTienToYDinh) {
    return {
      loai: 'TEN_APP',
      tuKhoa: cleanInput,
    };
  }

  // 3. LUỒNG Ý_ĐỊNH (P2-40.4): Câu dài hơn 3 từ, hoặc có dấu câu câu hỏi, hoặc chứa tiền tố mô tả nhu cầu
  return {
    loai: 'Y_DINH',
    tuKhoa: cleanInput,
  };
}

// Chữ cái tiếng Việt có dấu (khác với tên app tiếng Anh viết không dấu)
const CHU_CO_DAU_TIENG_VIET =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Cụm 2 đến 3 từ có chữ tiếng Việt có dấu (ví dụ "chụp màn hình", "ghi chú") thường là mô tả nhu cầu,
 * không phải tên app. Tên app tiếng Anh nhiều từ ("visual studio") vẫn tìm theo tên.
 */
export function laCumTuMoTaNhuCauTiengViet(tuKhoa: string): boolean {
  const tu = (tuKhoa || '').trim().split(/\s+/).filter(Boolean);
  return tu.length >= 2 && CHU_CO_DAU_TIENG_VIET.test(tuKhoa);
}
