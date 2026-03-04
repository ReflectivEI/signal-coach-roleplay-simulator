import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8787',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '/api'),
        ws: false,
        timeout: 30000, // 30 second timeout
      },
    },
    port: 5173,
  },
});
