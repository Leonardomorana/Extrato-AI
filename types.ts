export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface ExtractedData {
  transactions: Transaction[];
  bankName?: string;
  accountHolder?: string;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  balance: number;
}

export interface GlobalStats {
  totalIncome: number;
  totalExpense: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  netBalance: number;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
