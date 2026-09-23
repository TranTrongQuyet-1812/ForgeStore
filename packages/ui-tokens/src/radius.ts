/**
 * Hệ thống bo góc (Border Radius) của ForgeStore.
 * Hỗ trợ cả chuỗi px và số thuần cho React Native.
 */

export const radius = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px', // Trust Pill, Avatar tròn
} as const;

/**
 * Giá trị số thuần cho React Native borderRadius.
 */
export const radiusNumeric = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusNumeric = typeof radiusNumeric;
