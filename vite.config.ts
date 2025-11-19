import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do arquivo .env local (se existir)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioridade: 
  // 1. Vercel System Env (process.env.API_KEY)
  // 2. Arquivo .env local (env.API_KEY)
  // 3. Chave hardcoded fornecida pelo usuário (Fallback)
  const apiKey = process.env.API_KEY || env.API_KEY || 'AIzaSyB5ZiNr_91sJVHTb3fxY7mVH3vbq1Xqs_8';

  return {
    plugins: [react()],
    define: {
      // Injeta o valor da chave como uma string no código do cliente
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});