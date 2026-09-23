/**
 * Hệ thống khoảng cách chuẩn 8-Point Grid của ForgeStore.
 * Cung cấp cả chuỗi có đơn vị 'px' (cho Web/Tailwind) và số thuần (cho React Native).
 */

export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px', // Chuẩn vùng chạm nút bấm tối thiểu trên Mobile (48dp)
  14: '56px',
  16: '64px', // Chiều cao Top Header Desktop
  20: '80px',
  24: '96px',
  sidebar: '240px', // Chiều rộng Sidebar Desktop Tauri
  touchTarget: '48px', // Vùng chạm tối thiểu WCAG
} as const;

/**
 * Giá trị số thuần (number) hỗ trợ trực tiếp React Native StyleSheet.
 */
export const spacingNumeric = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  sidebar: 240,
  touchTarget: 48,
} as const;

export type Spacing = typeof spacing;
export type SpacingNumeric = typeof spacingNumeric;
