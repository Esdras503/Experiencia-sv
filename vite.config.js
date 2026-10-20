import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El API vive en funciones serverless (carpeta api/) y en un servidor local
// sin dependencias (npm run api). Vite solo actúa como proxy en desarrollo
// y en la vista previa para que el navegador siempre hable con /api.
const apiProxy = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
