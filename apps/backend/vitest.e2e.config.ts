import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Test e2e (P2-61): dựng cả AppModule trên Postgres và Redis thật nên cần SWC để Nest đọc được
// metadata của decorator (esbuild mặc định của Vitest không sinh ra), và chạy tuần tự từng tệp.
export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
