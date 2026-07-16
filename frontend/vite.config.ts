import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // react-draggable (транзитивная зависимость react-grid-layout/legacy) читает
  // process.env.NODE_ENV в браузере напрямую — Vite, в отличие от webpack, его не
  // шимит, без define drag на дашборде падал с ReferenceError при mousedown.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8010',
    },
  },
})
