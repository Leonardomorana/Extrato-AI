import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente da Vercel ou arquivo .env local
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Substitui 'process.env.API_KEY' pelo valor real durante o build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Garante que o objeto process.env não quebre se acessado de outras formas
      'process.env': {}
    }
  };
});