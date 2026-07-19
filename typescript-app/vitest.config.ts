import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    exclude: ['server/**/*.integration.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
