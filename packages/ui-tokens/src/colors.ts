import { NGUONG_AN_TOAN_CAO, NGUONG_CAN_LUU_Y } from '@forgestore/types';

/**
 * Hệ màu chuẩn ForgeStore theo tỷ lệ 60-30-10 (Cyber Minimalist & OLED Elevate).
 * Đạt chuẩn tương phản WCAG AA (>= 4.5:1 với text thường, >= 3:1 với UI controls).
 * Dùng được trực tiếp cho Tailwind CSS và React Native StyleSheet.
 */

export const colors = {
  // 60% - Canvas & Surface (Nền & Bề mặt)
  bgCanvas: '#1D2128', // Nền chính: Than chì ấm (Charcoal Slate), dịu mắt chống lóa
  bgSurface: '#242932', // Nền Card ứng dụng, Header, Tabbar
  bgSurfaceElevated: '#2C323D', // Nền Card khi Hover hoặc Modal nổi
  borderSubtle: '#2E3540', // Viền Card, Divider siêu mảnh 1px
  borderActive: '#444D5D', // Viền khi Focus / Selected

  // 30% - Typography (Hệ chữ phân cấp)
  textPrimary: '#F4F2F2', // Tiêu đề & Tên App: Soft Mist
  textSecondary: '#9BA3AF', // Mô tả ngắn & Tác giả: Xám bạc
  textMuted: '#687282', // Metadata, số phiên bản, dung lượng

  // 10% - Accents & Intelligence (Điểm nhấn nhận diện & AI)
  accentForge: '#FF9E20', // [Lửa Rèn] Forge Amber: Nút "Cài đặt 1-Click", CTA chính, Progress Bar
  accentForgeHover: '#E68A13', // Trạng thái hover/active nút cài đặt
  accentAi: '#215E61', // [Deep Teal] Huy hiệu Jev AI, nút "AI Tóm Tắt"

  // Semantic Tokens: Chỉ số Uy tín & Trạng thái An toàn (Ngưỡng 80/60)
  trustHigh: '#10B981', // Xanh Emerald: Trust Score 80-100 (Rất an toàn)
  trustMedium: '#F59E0B', // Vàng Amber: Trust Score 60-79 (Cần lưu ý / Ít update)
  trustLow: '#EF4444', // Đỏ Coral: Trust Score < 60 (Cảnh báo quyền nhạy cảm)

  // Trạng thái hệ thống mở rộng
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#215E61',

  // Cấu trúc phân nhóm ngữ nghĩa (Nested)
  bg: {
    canvas: '#1D2128',
    surface: '#242932',
    surfaceElevated: '#2C323D',
  },
  border: {
    subtle: '#2E3540',
    active: '#444D5D',
  },
  text: {
    primary: '#F4F2F2',
    secondary: '#9BA3AF',
    muted: '#687282',
  },
  accent: {
    forge: '#FF9E20',
    forgeHover: '#E68A13',
    ai: '#215E61',
  },
  trust: {
    high: '#10B981',
    medium: '#F59E0B',
    low: '#EF4444',
  },
} as const;

export type Colors = typeof colors;

/**
 * Lấy mã màu Trust Pill theo điểm số uy tín (0 - 100).
 * Ngưỡng chuẩn kế thừa trực tiếp từ @forgestore/types: >= 80 xanh, >= 60 vàng, < 60 đỏ.
 */
export function getTrustColor(score: number): string {
  if (score >= NGUONG_AN_TOAN_CAO) return colors.trustHigh;
  if (score >= NGUONG_CAN_LUU_Y) return colors.trustMedium;
  return colors.trustLow;
}
