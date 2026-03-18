export interface Member {
  id: string;
  name: string;
  contact_info: string; // JSON string
  join_date: string;
  status: 'active' | 'inactive' | 'suspended';
  member_type?: 'standard' | 'premium' | 'vip';
  auto_frozen?: number;
  notes: string;
  created_at: number;
  fee_status?: 'paid' | 'pending' | 'overdue';
  remaining_days?: number;
  due_reminder?: boolean;
  last_payment_date?: string;
  expiry_date?: string;
  fee_cycle?: 'month' | 'quarter' | 'year';
  fee_amount?: number;
  fee_history_count?: number;
  total_paid?: number;
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
  source_type?: string;
  source_ref_id?: string;
  version?: number;
  updated_at?: number;
  deleted_at?: number;
  // Joined fields
  category_name?: string;
  account_name?: string;
  member_name?: string;
  proof_count?: number;
}

export interface FeeProof {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: number;
}

export interface DashboardStats {
  totalAssets: number;
  periodType: 'year' | 'quarter' | 'month' | 'custom';
  startTime: string;
  endTime: string;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  trend: { label: string; income: number; expense: number }[];
  incomeComposition: { name: string; value: number }[];
  expenseComposition: { name: string; value: number }[];
  incomeItems: { category: string; amount: number; count: number }[];
  expenseItems: { category: string; amount: number; count: number }[];
  details: {
    id: string;
    date: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category_name: string;
  }[];
}
