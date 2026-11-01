import type { Config } from 'tailwindcss';
import tailwindPreset from '@forgestore/ui-tokens/preset';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  presets: [tailwindPreset as Config],
  theme: {
    extend: {
      colors: {
        // Tích hợp CSS Variables hỗ trợ theme Dark dịu mắt & Light ngà sữa
        canvas: 'var(--color-bg-canvas)',
        surface: 'var(--color-bg-surface)',
        'surface-elevated': 'var(--color-bg-surface-elevated)',
        'surface-hover': 'var(--color-bg-surface-hover)',
        border: 'var(--color-border-subtle)',
        'border-focus': 'var(--color-border-active)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        'on-accent': 'var(--color-text-on-accent)',
        // Màu trạng thái đổi theo giao diện sáng/tối để luôn đủ độ tương phản
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'accent-forge-text': 'rgb(var(--color-accent-forge-text) / <alpha-value>)',
        // Nền đặc (nút, chấm trạng thái): giữ nguyên ở cả hai giao diện
        'success-solid': '#059669',
        'danger-solid': '#e11d48',
        'warning-solid': '#f59e0b',
      },
    },
  },
  plugins: [],
};

export default config;
