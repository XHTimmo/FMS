import { ipcMain } from 'electron';
import { getDB } from '../database';
import dayjs from 'dayjs';

export function registerDashboardHandlers() {
  const db = getDB();

  ipcMain.handle('dashboard:stats', async () => {
    const now = dayjs();
    const startOfMonth = now.startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const endOfMonth = now.endOf('month').format('YYYY-MM-DD HH:mm:ss');

    // 1. Total Assets (Sum of all account balances)
    const totalAssets = db.prepare('SELECT SUM(balance) as total FROM accounts').get() as { total: number };

    // 2. Monthly Income & Expense
    const monthlyStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions 
      WHERE date BETWEEN ? AND ?
    `).get(startOfMonth, endOfMonth) as { income: number, expense: number };

    // 3. Trend (Last 6 months)
    const trendData: { month: string, income: number, expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = now.subtract(i, 'month').startOf('month').format('YYYY-MM-DD');
      const monthEnd = now.subtract(i, 'month').endOf('month').format('YYYY-MM-DD HH:mm:ss'); // Ensure full day coverage
      const monthLabel = now.subtract(i, 'month').format('YYYY-MM');
      
      const stat = db.prepare(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions 
        WHERE date >= ? AND date <= ?
      `).get(monthStart, monthEnd) as { income: number, expense: number };
      
      trendData.push({
        month: monthLabel,
        income: stat.income || 0,
        expense: stat.expense || 0
      });
    }

    // 4. Expense Composition (This Month)
    const expenseComposition = db.prepare(`
      SELECT c.name, SUM(t.amount) as value
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.name
      ORDER BY value DESC
    `).all(startOfMonth, endOfMonth);

    return {
      totalAssets: totalAssets.total || 0,
      monthlyIncome: monthlyStats.income || 0,
      monthlyExpense: monthlyStats.expense || 0,
      trend: trendData,
      composition: expenseComposition
    };
  });
}
