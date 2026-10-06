import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { themePlugin } from './config/theme.ts'

const PORT = 3000

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    themePlugin()
  ],
  server: {
    port: PORT
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      include: [
        'src/api/rijksmuseum/**',
        'src/features/search/**',
        'src/components/**'
      ],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: { lines: 90 }
    }
  }
})
