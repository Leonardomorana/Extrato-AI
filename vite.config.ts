import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do arquivo .env local (se existir)
  // O terceiro parâmetro '' diz para carregar tudo, não apenas as que começam com VITE_
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Na Vercel, as variáveis ficam em process.env. Localmente, podem vir de env.
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Injeta o valor da chave como uma string no código do cliente
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});