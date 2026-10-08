/**
 * Tiện ích so sánh phiên bản phần mềm (SemVer, CalVer, GitHub Tags) thuần khiết không side-effect (P2-52 & P3B-17).
 * Re-export từ @forgestore/types để đảm bảo tính nhất quán giữa Backend và Desktop.
 */

export {
  chuanHoaPhienBan,
  soSanhPhienBan,
  coBanMoiHon,
  kiemTraCoBanCapNhat,
  laTagKhongCoSo,
  parseBigIntAnToan,
  type ThongTinBanPhatHanhKiemTra,
} from '@forgestore/types';
