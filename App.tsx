import React, { useState } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import Dashboard from './components/Dashboard';
import { analyzeBankStatement } from './services/geminiService';
import { AppState, ExtractedData } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setAppState(AppState.PROCESSING);
    setError(null);
    
    try {
      const result = await analyzeBankStatement(file);
      setData(result);
      setAppState(AppState.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setAppState(AppState.ERROR);
      setError(err.message || "Ocorreu um erro inesperado ao processar o PDF.");
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="flex-1">
        {appState === AppState.IDLE || appState === AppState.PROCESSING || appState === AppState.ERROR ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                Transforme seu extrato PDF em <span className="text-indigo-600">dados acionáveis</span>
              </h1>
              <p className="text-lg text-slate-600">
                Utilize nossa IA para extrair transações, categorizar gastos e visualizar sua saúde financeira em segundos.
              </p>
            </div>
            
            <UploadZone 
              onFileSelect={handleFileSelect} 
              isProcessing={appState === AppState.PROCESSING} 
              error={error}
            />
            
            {/* Security Note */}
            <div className="mt-12 max-w-md text-center">
                <p className="text-xs text-slate-400">
                    🔒 Seus dados são processados de forma segura. Não armazenamos seus extratos bancários após a análise.
                </p>
            </div>
          </div>
        ) : (
            data && <Dashboard data={data} onReset={handleReset} />
        )}
      </main>
    </div>
  );
};

export default App;