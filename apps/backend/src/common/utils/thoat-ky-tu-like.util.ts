/**
 * Prisma dịch `equals` + `mode: 'insensitive'` thành ILIKE mà không thoát `%` và `_`, nên mã định danh
 * `%zz` khớp với mọi tên kết thúc bằng `zz` và `ten_goi` khớp cả `tenXgoi`. Thêm dấu gạch chéo ngược trước ba
 * ký tự đặc biệt để Postgres coi chúng là ký tự thường (đã kiểm với DB thật: `\%zz` không khớp gì).
 */
export function thoatKyTuLike(chuoi: string): string {
  return chuoi.replace(/[\\%_]/g, '\\$&');
}
