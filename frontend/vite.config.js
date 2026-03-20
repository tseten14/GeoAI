import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      // Served by Express from frontend/traffic-app/dist (run `npm run build:traffic` after UI changes).
      // For live traffic HMR when Rollup native deps work: `npm run dev:traffic` and temporarily point this at :8080.
      '/traffic': { target: 'http://127.0.0.1:3000', changeOrigin: true, ws: true }
    }
  },
  build: {
    outDir: 'dist',
    emptyDir: true
  }
});
