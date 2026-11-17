// P3B-38.1: lần chạm trần dịch lẻ đầu tiên chỉ hoãn vài phút, từ lần thứ 3 trong ngày mới hoãn 24 giờ.
// Từ 6 giờ trở xuống coi là hoãn ngắn, để không báo "ngày mai" khi chỉ cần chờ ít phút.
const NGUONG_HOAN_NGAN_MS = 6 * 60 * 60 * 1000;

/** `thuLaiLuc` là mốc thử lại (mili giây) do backend trả; thiếu mốc (backend cũ) thì coi như hoãn sang ngày mai. */
export function laHoanNgan(thuLaiLuc?: number | null, bayGio: number = Date.now()): boolean {
  return typeof thuLaiLuc === 'number' && thuLaiLuc - bayGio <= NGUONG_HOAN_NGAN_MS;
}

export function layThongBaoBanDichHoan(
  thuLaiLuc?: number | null,
  bayGio: number = Date.now(),
): string {
  const khiNao = laHoanNgan(thuLaiLuc, bayGio) ? 'trong ít phút nữa' : 'vào ngày mai';
  return `Bản dịch tiếng Việt sẽ có ${khiNao}. Hiện đang xem bản gốc tiếng Anh.`;
}
