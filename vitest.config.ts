import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 20000 },
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared'), '@content': path.resolve(__dirname, 'src/content') } },
});
