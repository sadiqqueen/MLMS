import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app:     resolve(__dirname, 'app.html'),
        landing: resolve(__dirname, 'landing.html'),
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'https://mlms-production.up.railway.app', changeOrigin: true },
      '/uploads': { target: 'https://mlms-production.up.railway.app', changeOrigin: true }
    }
  }
});
