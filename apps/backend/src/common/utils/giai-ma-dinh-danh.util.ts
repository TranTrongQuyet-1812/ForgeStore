/**
 * Giải mã mã định danh app (UUID hoặc slug `owner/repo`) lấy từ URL. Express đã giải mã một lần,
 * nên chuỗi có `%` lẻ (vd `%zz`) làm decodeURIComponent ném URIError và biến thành lỗi 500.
 * Gặp trường hợp đó thì giữ nguyên chuỗi gốc để các bước tìm app phía sau trả 404 bình thường.
 */
export function giaiMaDinhDanh(chuoi: string): string {
  const goc = chuoi.trim();
  try {
    return decodeURIComponent(goc);
  } catch {
    return goc;
  }
}
