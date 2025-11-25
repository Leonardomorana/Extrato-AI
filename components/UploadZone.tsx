import React, { useCallback, useState } from 'react';
import { UploadCloud, Loader2, AlertCircle, FileStack } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (files: File[]) => void;
  isProcessing: boolean;
  error: string | null;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isProcessing, error }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: File[] = Array.from(e.dataTransfer.files);
      const pdfFiles = files.filter(f => f.type === "application/pdf");
      
      if (pdfFiles.length > 0) {
        onFileSelect(pdfFiles);
      } else {
        alert("Por favor, envie apenas arquivos PDF.");
      }
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      const pdfFiles = files.filter(f => f.type === "application/pdf");
      if (pdfFiles.length > 0) {
        onFileSelect(pdfFiles);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 p-4">
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out
          ${dragActive ? "border-indigo-500 bg-indigo-50 scale-[1.02]" : "border-slate-300 bg-white hover:bg-slate-50"}
          ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleChange}
          accept="application/pdf"
          multiple // Permite múltiplos arquivos
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          {isProcessing ? (
            <>
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-700">Processando seus extratos...</p>
              <p className="text-sm text-slate-500 mt-2">A IA está unificando e analisando as transações.</p>
            </>
          ) : (
            <>
              <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-indigo-200' : 'bg-slate-100'}`}>
                {dragActive ? (
                   <UploadCloud className="w-10 h-10 text-indigo-700" />
                ) : (
                   <FileStack className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <p className="mb-2 text-lg text-slate-700 font-semibold">
                Arraste seus PDFs aqui ou clique para selecionar
              </p>
              <p className="text-sm text-slate-500">
                Você pode enviar um ou múltiplos extratos simultaneamente.
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Erro ao processar</h4>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadZone;