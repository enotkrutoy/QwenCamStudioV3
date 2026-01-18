import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Загружаем переменные из .env файлов
  const env = loadEnv(mode, process.cwd(), '');
  
  // Приоритет: системная переменная (Vercel) > .env файл
  const apiKey = process.env.API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Точечная замена API ключа для geminiService.ts
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Позволяем коду проверять NODE_ENV без поломки всего объекта process.env
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-three': ['three'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});