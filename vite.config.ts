import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de arquivos .env (local)
  // O terceiro argumento '' permite carregar variáveis sem prefixo VITE_
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioriza a variável do sistema (Vercel) se disponível, senão usa a do arquivo .env
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Substitui process.env.API_KEY pelo valor real da chave (string) durante o build
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Previne erros caso alguma biblioteca tente acessar process.env
      'process.env': {} 
    }
  };
});