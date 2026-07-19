import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || !testDatabaseUrl.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to an isolated database whose name ends with _test.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.integration.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
