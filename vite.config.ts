import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Same-origin API in development: the refresh cookie stays first-party (SameSite=Strict).
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
    // The API has its own build; its dev database and S3 files change constantly and must not be watched.
    watch: { ignored: ['**/server/**', '**/docs/**', '**/dist/**'] },
  },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } } },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
