import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globalSetup: './vitest.global-setup.ts',
    environment: 'jsdom',
  },
});
