export interface Member {
  id: string;
  name: string;
  contact_info: string; // JSON string
  join_date: string;
  status: 'active' | 'inactive' | 'suspended';
  notes: string;
  created_at: number;
}

export interface Account {
  id: number;
  name: string;
  type: 'cash' | 'bank' | 'online';
  balance: number;
  currency: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  parent_id?: number;
  icon?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  account_id: number;
  to_account_id?: number;
  category_id: number;
  description: string;
  member_id?: string;
  created_by: number;
  created_at: number;
  // Joined fields
  category_name?: string;
  account_name?: string;
}

export interface DashboardStats {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpense: number;
  trend: { month: string; income: number; expense: number }[];
  composition: { name: string; value: number }[];
}
