import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Restart timestamp: 2026-09-16T14:04:20+07:00
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
