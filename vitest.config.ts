import { defineConfig } from 'vitest/config'

// Parser tests run against a real DOM (jsdom) so they exercise the same
// querySelector / textContent / location code paths as the live userscript.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
