import React from 'react';
import { Wallet, BarChart3 } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">ExtratoAI <span className="text-indigo-600">Pro</span></span>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <BarChart3 className="w-4 h-4" />
              <span>Análise Financeira Inteligente</span>
           </div>
        </div>
      </div>
    </header>
  );
};

export default Header;