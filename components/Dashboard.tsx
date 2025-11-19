import React, { useMemo, useState } from 'react';
import { ExtractedData, MonthlyStats, GlobalStats } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Calendar, Search, Filter, ArrowUpDown, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardProps {
  data: ExtractedData;
  onReset: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [typeFilter, setTypeFilter] = useState<string>('all'); // 'all' | 'income' | 'expense'

  // --- Calculations ---
  const processedData = useMemo(() => {
    const monthlyData: Record<string, MonthlyStats> = {};
    let totalInc = 0;
    let totalExp = 0;
    
    const sortedTransactions = [...data.transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedTransactions.forEach(t => {
      const date = new Date(t.date);
      // Use UTC to avoid timezone shifts changing the month
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, income: 0, expense: 0, balance: 0 };
      }

      if (t.amount > 0) {
        monthlyData[monthKey].income += t.amount;
        totalInc += t.amount;
      } else {
        monthlyData[monthKey].expense += Math.abs(t.amount);
        totalExp += Math.abs(t.amount);
      }
      monthlyData[monthKey].balance += t.amount;
    });

    const months = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const monthCount = months.length || 1;

    const stats: GlobalStats = {
      totalIncome: totalInc,
      totalExpense: totalExp,
      averageMonthlyIncome: totalInc / monthCount,
      averageMonthlyExpense: totalExp / monthCount,
      netBalance: totalInc - totalExp
    };

    return { months, stats, sortedTransactions };
  }, [data]);

  // --- Filtering ---
  const categories = useMemo(() => {
    const cats = new Set(data.transactions.map(t => t.category));
    return ['Todas', ...Array.from(cats).sort()];
  }, [data]);

  const filteredTransactions = useMemo(() => {
    return processedData.sortedTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'Todas' || t.category === categoryFilter;
      
      let matchesType = true;
      if (typeFilter === 'income') {
        matchesType = t.amount > 0;
      } else if (typeFilter === 'expense') {
        matchesType = t.amount < 0;
      }

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [processedData.sortedTransactions, searchTerm, categoryFilter, typeFilter]);


  // --- Formatters ---
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- PDF Export ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Relatório Financeiro - ExtratoAI Pro', 14, 20);

    // Sub Header (Bank Info)
    doc.setFontSize(12);
    doc.setTextColor(100);
    const bankText = data.bankName ? `${data.bankName} ${data.accountHolder ? `| ${data.accountHolder}` : ''}` : 'Extrato Bancário';
    doc.text(bankText, 14, 30);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

    // Summary Section
    const totalIncome = filteredTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;

    doc.setDrawColor(200);
    doc.line(14, 42, pageWidth - 14, 42);

    doc.setFontSize(10);
    doc.text('Resumo do Período (Filtrado):', 14, 50);
    
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Emerald Green
    doc.text(`Receitas: ${formatCurrency(totalIncome)}`, 14, 58);
    
    doc.setTextColor(244, 63, 94); // Rose Red
    doc.text(`Despesas: ${formatCurrency(totalExpense)}`, 80, 58);
    
    doc.setTextColor(40); // Black/Dark Gray
    doc.text(`Saldo Líquido: ${formatCurrency(balance)}`, 150, 58);

    // Table - Separando Entradas e Saídas para melhor visualização
    const tableBody = filteredTransactions.map(t => [
      formatDate(t.date),
      t.description,
      t.category,
      t.amount < 0 ? formatCurrency(t.amount) : '', // Coluna Saídas
      t.amount > 0 ? formatCurrency(t.amount) : ''  // Coluna Entradas
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Data', 'Descrição', 'Categoria', 'Saídas (-)', 'Entradas (+)']],
      body: tableBody,
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30 },
        3: { cellWidth: 30, halign: 'right' }, // Saídas
        4: { cellWidth: 30, halign: 'right' }, // Entradas
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
            // Estilo para coluna de Saídas (Index 3)
            if (data.column.index === 3 && data.cell.raw) {
                data.cell.styles.textColor = [220, 38, 38]; // Red
            }
            // Estilo para coluna de Entradas (Index 4)
            if (data.column.index === 4 && data.cell.raw) {
                data.cell.styles.textColor = [22, 163, 74]; // Green
            }
        }
      }
    });

    doc.save('relatorio_extrato_ai.pdf');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resumo do Extrato</h2>
          {data.bankName && <p className="text-slate-500 text-sm font-medium mt-1">{data.bankName} • {data.accountHolder}</p>}
        </div>
        <div className="flex gap-3">
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" />
                Exportar PDF
            </button>
            <button onClick={onReset} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Carregar Novo
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Média Mensal (Receita)" 
          value={processedData.stats.averageMonthlyIncome} 
          icon={<ArrowUpCircle className="w-5 h-5 text-emerald-500" />}
          trend="Baseado no histórico"
          colorClass="text-emerald-600"
        />
         <StatsCard 
          title="Média Mensal (Despesas)" 
          value={processedData.stats.averageMonthlyExpense} 
          icon={<ArrowDownCircle className="w-5 h-5 text-rose-500" />}
          trend="Baseado no histórico"
          colorClass="text-rose-600"
        />
        {/* Removed Total Balance Card as requested previously, maintaining layout */}
         <StatsCard 
          title="Período Analisado" 
          value={`${processedData.months.length} Meses`} 
          icon={<Calendar className="w-5 h-5 text-blue-500" />}
          trend="Duração do extrato"
          isCurrency={false}
          colorClass="text-slate-800"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Fluxo Mensal (Entradas)</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData.months} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 12}} 
                tickFormatter={(value) => `R$ ${value/1000}k`}
              />
              <Tooltip 
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                formatter={(value: number) => formatCurrency(value)}
                cursor={{fill: '#f8fafc'}}
              />
              <Legend wrapperStyle={{paddingTop: '20px'}} />
              <Bar name="Entradas" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 md:items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Detalhamento das Transações</h3>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* Search Input */}
                <div className="relative flex-grow sm:flex-grow-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
                    />
                </div>

                {/* Type Filter (In/Out) */}
                <div className="relative flex-grow sm:flex-grow-0">
                    <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none w-full sm:w-40 cursor-pointer"
                    >
                        <option value="all">Tudo</option>
                        <option value="income">Entradas</option>
                        <option value="expense">Saídas</option>
                    </select>
                </div>

                {/* Category Filter */}
                <div className="relative flex-grow sm:flex-grow-0">
                     <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none w-full sm:w-40 cursor-pointer"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{formatDate(t.date)}</td>
                  <td className="px-6 py-4 text-slate-800 font-medium">{t.description}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {t.category}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-semibold ${t.amount >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                  <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          Nenhuma transação encontrada com os filtros atuais.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  colorClass: string;
  isCurrency?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, colorClass, isCurrency = true }) => {
  const formattedValue = isCurrency && typeof value === 'number' 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : value;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      </div>
      <div>
        <h4 className={`text-2xl font-bold tracking-tight ${colorClass}`}>{formattedValue}</h4>
        {trend && <p className="text-xs text-slate-400 mt-1 font-medium">{trend}</p>}
      </div>
    </div>
  );
};

export default Dashboard;