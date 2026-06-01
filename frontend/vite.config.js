import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

  return {
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
        '/api':     { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true }
      }
    }
  };
});
