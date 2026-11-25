/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Only our own code may run, and data may only go to Supabase. Build only: the dev server needs inline scripts.
const csp: Plugin = {
  name: 'csp', apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', injectTo: 'head-prepend', attrs: { 'http-equiv': 'Content-Security-Policy', content:
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'" } }],
}

// GitHub Pages serves the site from /<repo>/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/littlechicknest/',
  plugins: [react(), tailwindcss(), csp],
  build: {
    sourcemap: false,
    // vendor code changes rarely, so it gets its own long-cached chunks
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
