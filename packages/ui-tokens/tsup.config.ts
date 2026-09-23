import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/tailwind-preset.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  footer: {
    js: 'if (typeof module !== "undefined" && module.exports && module.exports.default) { Object.assign(module.exports, module.exports.default); }',
  },
});
