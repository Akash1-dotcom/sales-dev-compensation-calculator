import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this app from https://<user>.github.io/<repo>/, so
  // assets must be requested with that subpath prefix in production.
  base: process.env.GITHUB_PAGES === 'true' ? '/sales-dev-compensation-calculator/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
