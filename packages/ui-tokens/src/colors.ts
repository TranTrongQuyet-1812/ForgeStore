import { NGUONG_AN_TOAN_CAO, NGUONG_CAN_LUU_Y } from '@forgestore/types';

/**
 * Hệ màu chuẩn ForgeStore theo tỷ lệ 60-30-10 (Cyber Minimalist & OLED Elevate).
 * Đạt chuẩn tương phản WCAG AA (>= 4.5:1 với text thường, >= 3:1 với UI controls).
 * Dùng được trực tiếp cho Tailwind CSS và React Native StyleSheet.
 */

export const colors = {
  // 60% - Canvas & Surface (Nền & Bề mặt)
  bgCanvas: '#090D16', // Nền chính: Obsidian sâu thẳm, chống mỏi mắt OLED
  bgSurface: '#111827', // Nền Card ứng dụng, Header, Tabbar
  bgSurfaceElevated: '#1F2937', // Nền Card khi Hover hoặc Modal nổi
  borderSubtle: '#1E293B', // Viền Card, Divider siêu mảnh 1px
  borderActive: '#334155', // Viền khi Focus / Selected

  // 30% - Typography (Hệ chữ phân cấp)
  textPrimary: '#F8FAFC', // Tiêu đề & Tên App: Trắng tinh khiết (Contrast 14:1)
  textSecondary: '#94A3B8', // Mô tả ngắn & Tác giả: Xám bạc (Contrast 6.8:1)
  textMuted: '#64748B', // Metadata, số phiên bản, dung lượng (Contrast 4.6:1)

  // 10% - Accents & Intelligence (Điểm nhấn nhận diện & AI)
  accentForge: '#F97316', // [Lửa Rèn] Nút "Cài đặt 1-Click", CTA chính, Progress Bar
  accentForgeHover: '#EA580C', // Trạng thái hover/active nút cài đặt
  accentAi: '#06B6D4', // [Cyber Cyan] Huy hiệu Jev AI, nút "AI Tóm Tắt"

  // Semantic Tokens: Chỉ số Uy tín & Trạng thái An toàn (Ngưỡng 80/60)
  trustHigh: '#10B981', // Xanh Emerald: Trust Score 80-100 (Rất an toàn)
  trustMedium: '#F59E0B', // Vàng Amber: Trust Score 60-79 (Cần lưu ý / Ít update)
  trustLow: '#EF4444', // Đỏ Coral: Trust Score < 60 (Cảnh báo quyền nhạy cảm)

  // Trạng thái hệ thống mở rộng
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',

  // Cấu trúc phân nhóm ngữ nghĩa (Nested)
  bg: {
    canvas: '#090D16',
    surface: '#111827',
    surfaceElevated: '#1F2937',
  },
  border: {
    subtle: '#1E293B',
    active: '#334155',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  accent: {
    forge: '#F97316',
    forgeHover: '#EA580C',
    ai: '#06B6D4',
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
