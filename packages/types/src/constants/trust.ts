import { MucDoUyTin } from '../enums.js';

export const NGUONG_AN_TOAN_CAO = 80;
export const NGUONG_CAN_LUU_Y = 60;

/**
 * Phân loại mức độ an toàn dựa trên điểm số uy tín Trust Score (0 - 100).
 * - >= 80: AN_TOAN_CAO (Xanh Emerald)
 * - >= 60 và < 80: CAN_LUU_Y (Vàng Amber)
 * - < 60: CANH_BAO_RUI_RO (Đỏ Coral)
 */
export function phanLoaiDiemUyTin(diem: number): MucDoUyTin {
  if (diem >= NGUONG_AN_TOAN_CAO) {
    return MucDoUyTin.AN_TOAN_CAO;
  }
  if (diem >= NGUONG_CAN_LUU_Y) {
    return MucDoUyTin.CAN_LUU_Y;
  }
  return MucDoUyTin.CANH_BAO_RUI_RO;
}
