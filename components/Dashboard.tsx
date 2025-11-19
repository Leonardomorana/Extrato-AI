import React, { useMemo, useState, useEffect } from 'react';
import { ExtractedData, MonthlyStats, GlobalStats, Transaction } from '../types';
import { ArrowUpCircle, Calendar, Search, Filter, Download, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface DashboardProps {
  data: ExtractedData;
  onReset: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onReset }) => {
  // Estado local para permitir edição das transações
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(data.transactions);
  
  // Sincroniza se a prop data mudar (ex: novo upload)
  useEffect(() => {
    setLocalTransactions(data.transactions);
  }, [data]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null = creating
  const [formData, setFormData] = useState<Transaction>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Geral',
    amount: 0
  });

  // --- Calculations based on localTransactions (INCOME ONLY) ---
  const processedData = useMemo(() => {
    const monthlyData: Record<string, MonthlyStats> = {};
    let totalInc = 0;
    
    // Filtrar apenas ENTRADAS (> 0) e ordenar
    const incomeTransactions = localTransactions.filter(t => t.amount > 0);
    
    const sortedData = [...incomeTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedData.forEach(t => {
      const date = new Date(t.date);
      // Use UTC to avoid timezone shifts
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, income: 0, expense: 0, balance: 0 };
      }

      monthlyData[monthKey].income += t.amount;
      totalInc += t.amount;
      monthlyData[monthKey].balance += t.amount;
    });

    const months = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const monthCount = months.length || 1;

    const stats: GlobalStats = {
      totalIncome: totalInc,
      totalExpense: 0, // Despesas ignoradas
      averageMonthlyIncome: totalInc / monthCount,
      averageMonthlyExpense: 0,
      netBalance: totalInc
    };

    return { months, stats, sortedTransactions: sortedData };
  }, [localTransactions]);

  // --- Filtering ---
  const categories = useMemo(() => {
    // Categorias baseadas apenas nas transações de entrada
    const cats = new Set(processedData.sortedTransactions.map(t => t.category));
    return ['Todas', ...Array.from(cats).sort()];
  }, [processedData.sortedTransactions]);

  const filteredTransactions = useMemo(() => {
    return processedData.sortedTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'Todas' || t.category === categoryFilter;
      // Filtro de tipo removido pois só existem entradas agora
      return matchesSearch && matchesCategory;
    });
  }, [processedData.sortedTransactions, searchTerm, categoryFilter]);

  // --- CRUD Handlers ---

  const handleAddNew = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Geral',
      amount: 0
    });
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEdit = (transaction: Transaction) => {
    const index = localTransactions.indexOf(transaction);
    setEditingIndex(index);
    setFormData({ ...transaction, amount: Math.abs(transaction.amount) });
    setIsModalOpen(true);
  };

  const handleDelete = (transaction: Transaction) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      const newTransactions = localTransactions.filter(t => t !== transaction);
      setLocalTransactions(newTransactions);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Força valor positivo (Receita)
    const finalAmount = Math.abs(formData.amount);

    const newTransaction: Transaction = {
      ...formData,
      amount: finalAmount
    };

    if (editingIndex !== null && editingIndex >= 0) {
      // Editando
      const updated = [...localTransactions];
      updated[editingIndex] = newTransaction;
      setLocalTransactions(updated);
    } else {
      // Criando
      setLocalTransactions([newTransaction, ...localTransactions]);
    }
    setIsModalOpen(false);
  };


  // --- Formatters ---
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- PDF Export ---
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Relatório de Receitas - ExtratoAI Pro', 14, 20);

    // Sub Header
    doc.setFontSize(12);
    doc.setTextColor(100);
    const bankText = data.bankName ? `${data.bankName} ${data.accountHolder ? `| ${data.accountHolder}` : ''}` : 'Extrato Bancário';
    doc.text(bankText, 14, 30);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

    // Renda Média Line
    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text(`Renda Média Apurada: ${formatCurrency(processedData.stats.averageMonthlyIncome)}`, 14, 44);

    // Capture Chart
    let chartImage = null;
    const chartElement = document.getElementById('monthly-chart');
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, { scale: 2 });
        chartImage = canvas.toDataURL('image/png');
      } catch (err) {
        console.error("Erro ao capturar gráfico", err);
      }
    }

    let currentY = 50;

    // Insert Chart if available
    if (chartImage) {
      const imgProps = doc.getImageProperties(chartImage);
      const pdfWidth = pageWidth - 28;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.addImage(chartImage, 'PNG', 14, currentY, pdfWidth, pdfHeight);
      currentY += pdfHeight + 10;
    } else {
      currentY += 10;
    }

    // Summary Section (Below Chart)
    const totalIncome = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);

    doc.setDrawColor(200);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text('Resumo do Período (Filtrado):', 14, currentY);
    currentY += 8;
    
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Emerald Green
    doc.text(`Receitas Totais: ${formatCurrency(totalIncome)}`, 14, currentY);
    
    currentY += 10;

    // Table
    const tableBody = filteredTransactions.map(t => [
      formatDate(t.date),
      t.description,
      t.category,
      formatCurrency(t.amount)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: tableBody,
      headStyles: { fillColor: [16, 185, 129] }, // Emerald Green for Income
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40 },
        3: { cellWidth: 40, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
            if (data.column.index === 3 && data.cell.raw) {
                data.cell.styles.textColor = [22, 163, 74]; // Green text
            }
        }
      }
    });

    doc.save('relatorio_receitas_ai.pdf');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resumo de Receitas</h2>
          {data.bankName && <p className="text-slate-500 text-sm font-medium mt-1">{data.bankName} • {data.accountHolder}</p>}
        </div>
        <div className="flex gap-3 flex-wrap">
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
                <Plus className="w-4 h-4" />
                Nova Entrada
            </button>
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

      {/* KPI Cards - REMOVED EXPENSES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsCard 
          title="Média Mensal (Receita)" 
          value={processedData.stats.averageMonthlyIncome} 
          icon={<ArrowUpCircle className="w-5 h-5 text-emerald-500" />}
          trend="Baseado no histórico"
          colorClass="text-emerald-600"
        />
         <StatsCard 
          title="Período Analisado" 
          value={`${processedData.months.length} Meses`} 
          icon={<Calendar className="w-5 h-5 text-blue-500" />}
          trend="Duração do extrato"
          isCurrency={false}
          colorClass="text-slate-800"
        />
      </div>

      {/* Chart Section - Only Income */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100" id="monthly-chart">
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

      {/* Transactions Table - Income Only */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 md:items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Detalhamento das Entradas</h3>
            
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
                <th className="px-6 py-3 text-right">Ações</th>
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
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(t)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                  <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          Nenhuma transação de entrada encontrada.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-800">
                        {editingIndex !== null ? 'Editar Entrada' : 'Nova Entrada'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                        <input 
                            type="text" 
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: Salário"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                            <input 
                                type="date" 
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                            <input 
                                type="text" 
                                required
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                list="category-list"
                            />
                            <datalist id="category-list">
                                {categories.filter(c => c !== 'Todas').map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

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