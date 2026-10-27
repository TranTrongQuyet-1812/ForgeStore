import type { DongDaKiem } from './data-repo.types';

/**
 * Cảnh báo chất lượng cho bản dịch đã đạt kiểm cấu trúc (không chặn, chỉ để Chủ lọc nhanh chỗ cần đọc tay).
 * Các quy tắc lấy từ bảng thuật ngữ và luật mô tả trong AGENTS.md.
 */
export interface CanhBao {
  repo: string;
  loai: string;
  chiTiet: string;
}

const TINH_TU_KHEN = [
  'mạnh mẽ',
  'thông minh',
  'tiện lợi',
  'nhanh chóng',
  'đáng tin cậy',
  'linh hoạt',
  'tối ưu',
  'hoàn hảo',
  'tuyệt vời',
];

/** Vi phạm bảng thuật ngữ: [mẫu, mã cảnh báo, gợi ý] */
const THUAT_NGU_SAI: Array<[RegExp, string, string]> = [
  [/yêu cầu kéo|yêu cầu hợp nhất/gi, 'thuat_ngu_pull_request', 'giữ nguyên "pull request"'],
  [/tải xuống/gi, 'thuat_ngu_tai_ve', 'dùng "tải về"'],
  [/cộng tác viên/gi, 'thuat_ngu_nguoi_dong_gop', 'dùng "người đóng góp"'],
  [/thiết bị đầu cuối/gi, 'thuat_ngu_terminal', 'giữ nguyên "terminal"'],
  [/kho lưu trữ/gi, 'thuat_ngu_kho', 'dùng "kho"'],
];

/** Bỏ khối mã, mã nội dòng và phần URL của link để chỉ xét văn xuôi. */
function chiVanXuoi(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/\]\([^)]*\)/g, ']');
}

export function canhBaoDong(dong: DongDaKiem): CanhBao[] {
  const kq: CanhBao[] = [];
  const them = (loai: string, chiTiet: string) => kq.push({ repo: dong.repo, loai, chiTiet });

  if (dong.hangChatLuong) {
    them(`hang_chat_luong_${dong.hangChatLuong}`, 'Xếp hạng bộ kiểm cấu trúc README');
  }
  for (const canhBao of dong.canhBaoChatLuong ?? []) {
    them(`readme_${canhBao}`, 'Cần xem lại README hoặc chờ benchmark chốt ngưỡng');
  }

  const moTa = dong.moTaVi ?? '';
  if (moTa) {
    const khen = TINH_TU_KHEN.filter((t) => moTa.toLowerCase().includes(t));
    if (khen.length) them('mo_ta_tinh_tu_khen', khen.join(', '));
    if (moTa.length > 160) them('mo_ta_dai', `${moTa.length} ký tự`);
    // Từ hai câu trở lên: dấu chấm theo sau là khoảng trắng rồi chữ cái viết hoa
    if (/[.!?]\s+\p{Lu}/u.test(moTa)) them('mo_ta_nhieu_cau', moTa.slice(0, 80));
    if (dong.moTaEn && moTa.length > dong.moTaEn.length * 2 + 20) {
      them('mo_ta_dai_hon_goc_nhieu', `gốc ${dong.moTaEn.length}, dịch ${moTa.length} ký tự`);
    }
  }

  const van = chiVanXuoi(dong.readmeVi ?? '');
  for (const [mau, ma, goiY] of THUAT_NGU_SAI) {
    const n = (van.match(mau) ?? []).length;
    if (n > 0) them(ma, `${n} lần, ${goiY}`);
  }
  const nRepository = (van.match(/\brepository\b/gi) ?? []).length;
  if (nRepository > 3) them('thuat_ngu_repository_con_nhieu', `${nRepository} lần, dùng "kho"`);

  return kq;
}
