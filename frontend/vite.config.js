import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O frontend NUNCA fala direto com o banco: todas as chamadas vão para /api,
 * que em desenvolvimento é proxy para o backend Node e em produção aponta
 * para VITE_API_URL (ou para a mesma origem, quando o backend serve o build).
 */
const BACKEND = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // aceita hosts de preview/proxy (necessário em sandboxes e túneis)
    allowedHosts: true,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // espelha o health check raiz do backend também em desenvolvimento
      '/health': { target: BACKEND, changeOrigin: true, secure: false },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/health': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
