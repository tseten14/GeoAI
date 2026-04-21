import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        timeout: 900000,
        proxyTimeout: 900000,
      },
      // Traffic Insights Vite dev server (also started by root `npm run dev`).
      // Production / `npm start`: Express still serves frontend/traffic/dist (run `npm run build:traffic`).
      '/traffic': { target: 'http://127.0.0.1:8080', changeOrigin: true, ws: true }
    }
  },
  build: {
    outDir: 'dist',
    emptyDir: true
  }
});
