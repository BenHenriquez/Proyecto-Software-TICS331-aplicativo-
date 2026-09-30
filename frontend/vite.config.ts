/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// El .env vive en la raíz del monorepo. Solo se lee PORT para el proxy;
// el token del backoffice nunca se expone al front (no lleva prefijo VITE_).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const puertoApi = env.PORT || '3001';

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
    },
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${puertoApi}`,
      },
    },
  };
});
