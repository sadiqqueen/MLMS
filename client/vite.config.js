import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is the build tool / dev server for the React app.
export default defineConfig({
  plugins: [react()],   // enables JSX and React Fast Refresh (instant updates on save)
  server: {
    port: 5173,
    proxy: {
      // When the React app makes a request to /api/..., Vite forwards it to the backend.
      // This means in development you don't need to write the full server URL in every request.
      '/api':     { target: 'https://mlms-production.up.railway.app', changeOrigin: true },
      '/uploads': { target: 'https://mlms-production.up.railway.app', changeOrigin: true }
    }
  }
});
