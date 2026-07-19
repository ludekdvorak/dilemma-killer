import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'server/index.ts',
    migrate: 'server/db/migrate-cli.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'build',
  sourcemap: true,
  clean: true,
});
