/**
 * Cấu trúc phân trang chuẩn (Pagination Wrapper) cho các danh sách API.
 */
export interface TrangKetQua<T> {
  duLieu: T[];
  tongSo: number;
  trangHienTai: number;
  tongSoTrang: number;
  kichThuocTrang: number;
}
