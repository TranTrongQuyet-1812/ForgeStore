import { colors } from './colors.js';
import { typography } from './typography.js';
import { spacing } from './spacing.js';
import { radius } from './radius.js';

/**
 * Tailwind CSS Preset tích hợp trọn vẹn Design Tokens của ForgeStore.
 * Dùng trực tiếp trong tailwind.config.js của Desktop (Tauri) và Landing Page:
 * presets: [require('@forgestore/ui-tokens/preset')]
 * hoặc: import tailwindPreset from '@forgestore/ui-tokens/preset';
 */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        'bg-canvas': colors.bgCanvas,
        'bg-surface': colors.bgSurface,
        'bg-surface-elevated': colors.bgSurfaceElevated,
        'border-subtle': colors.borderSubtle,
        'border-active': colors.borderActive,
        'text-primary': colors.textPrimary,
        'text-secondary': colors.textSecondary,
        'text-muted': colors.textMuted,
        'accent-forge': colors.accentForge,
        'accent-forge-hover': colors.accentForgeHover,
        'accent-ai': colors.accentAi,
        'trust-high': colors.trustHigh,
        'trust-medium': colors.trustMedium,
        'trust-low': colors.trustLow,
      },
      fontFamily: {
        display: [typography.fontFamily.display],
        body: [typography.fontFamily.body],
        mono: [typography.fontFamily.mono],
      },
      spacing: {
        sidebar: spacing.sidebar,
        touchTarget: spacing.touchTarget,
      },
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        '2xl': radius['2xl'],
        full: radius.full,
      },
    },
  },
};

export default tailwindPreset;
