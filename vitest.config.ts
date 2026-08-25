import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['tests/e2e/**/*.spec.ts', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
