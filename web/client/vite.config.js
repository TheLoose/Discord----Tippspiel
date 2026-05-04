import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy only used in local dev — in production Express serves everything
    proxy: {
      '/api':  { target: 'http://localhost:3001', changeOrigin: true, credentials: true },
      '/auth': { target: 'http://localhost:3001', changeOrigin: true, credentials: true }
    }
  }
});