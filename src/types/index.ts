export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date: string;
}

export interface TransactionStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  expensesByCategory: Record<string, number>;
}

export interface BudgetGoal {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'annual';
  isActive: boolean;
  createdAt: string;
}

export type RootStackParamList = {
  Home: undefined;
  AddTransaction: undefined;
  TransactionDetail: { transaction: Transaction };
  BudgetGoals: undefined;
  CustomizeCategories: undefined;
  Settings: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Add: undefined;
  Goals: undefined;
}; 