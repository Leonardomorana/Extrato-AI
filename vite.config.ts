import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do arquivo .env local (se existir)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioridade: 
  // 1. Vercel System Env (process.env.API_KEY)
  // 2. Arquivo .env local (env.API_KEY)
  // A chave hardcoded foi removida por segurança.
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    build: {
      target: 'esnext'
    },
    esbuild: {
      target: 'esnext'
    },
    define: {
      // Injeta o valor da chave como uma string no código do cliente
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});