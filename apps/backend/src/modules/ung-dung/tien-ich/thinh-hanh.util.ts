/** Hệ số thiết kế để repo đã lưu trữ vẫn hiện nhưng có điểm thịnh hành thấp hơn. */
export const HE_SO_THINH_HANH_REPO_DA_LUU_TRU = 0.5;

export function tinhDiemThinhHanh(
  sao: number,
  soNgay: number,
  heSoThuongBanMoi: number,
  daLuuTru: boolean,
): number {
  const diemGoc = (Math.log10(sao + 1) / Math.pow(soNgay + 2, 1.5)) * heSoThuongBanMoi;
  return diemGoc * (daLuuTru ? HE_SO_THINH_HANH_REPO_DA_LUU_TRU : 1);
}
