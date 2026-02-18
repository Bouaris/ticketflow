import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

// Mirror the Vite define constants so tests can import src/lib/version.ts
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __CHANGELOG_CONTENT__: JSON.stringify(''),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'src-tauri'],
    setupFiles: ['./src/test-utils/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/lib/**', 'src/hooks/**', 'src/types/**', 'src/components/ui/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test-utils/**',
      ],
      thresholds: {
        'src/lib/parser.ts': { lines: 70, functions: 70 },
        'src/lib/serializer.ts': { lines: 70, functions: 70 },
        'src/lib/ai-retry.ts': { lines: 70, functions: 70 },
        'src/lib/ai-health.ts': { lines: 70, functions: 70 },
      },
    },
  },
});
