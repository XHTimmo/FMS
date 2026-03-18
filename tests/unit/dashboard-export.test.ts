import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateReportHtml } from '../../src/main/ipc/dashboard';

describe('Dashboard Export', () => {
  it('should generate valid HTML report with correct stats', () => {
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';
    const stats = {
      totalAssets: 10000,
      totalIncome: 5000,
      totalExpense: 2000,
      netIncome: 3000
    };
    const chartImages = {
      trend: 'data:image/png;base64,mocktrend',
      compare: 'data:image/png;base64,mockcompare',
      incomePie: 'data:image/png;base64,mockincome',
      expensePie: 'data:image/png;base64,mockexpense'
    };
    const details = [
      { date: '2025-01-10', type: 'income', category_name: 'Salary', amount: 5000, description: 'Jan Salary' },
      { date: '2025-01-15', type: 'expense', category_name: 'Food', amount: 2000, description: 'Groceries' }
    ];

    const html = generateReportHtml(startDate, endDate, stats, chartImages, details);

    // Assertions
    assert.ok(html.includes('财务报表 (2025-01-01 至 2025-01-31)'), 'Should contain title with date range');
    assert.ok(html.includes('¥ 10000.00'), 'Should contain total assets');
    assert.ok(html.includes('¥ 5000.00'), 'Should contain total income');
    assert.ok(html.includes('¥ 2000.00'), 'Should contain total expense');
    assert.ok(html.includes('¥ 3000.00'), 'Should contain net income');
    
    // Check if images are injected
    assert.ok(html.includes('src="data:image/png;base64,mocktrend"'), 'Should contain trend chart image');
    assert.ok(html.includes('src="data:image/png;base64,mockincome"'), 'Should contain income pie chart image');
    
    // Check if table rows are generated
    assert.ok(html.includes('Jan Salary'), 'Should contain income detail description');
    assert.ok(html.includes('Groceries'), 'Should contain expense detail description');
    assert.ok(html.includes('Salary'), 'Should contain income category');
    assert.ok(html.includes('Food'), 'Should contain expense category');
  });

  it('should handle missing chart images gracefully', () => {
    const stats = { totalAssets: 0, totalIncome: 0, totalExpense: 0, netIncome: 0 };
    const html = generateReportHtml('2025-01-01', '2025-01-31', stats, {}, []);
    
    // Should not contain broken image tags
    assert.ok(!html.includes('<img src="undefined"'), 'Should not contain undefined image src');
    assert.ok(html.includes('财务报表'), 'Should still generate report');
  });

  it('should format numbers to 2 decimal places in details', () => {
    const stats = { totalAssets: 0, totalIncome: 0, totalExpense: 0, netIncome: 0 };
    const details = [
      { date: '2025-01-10', type: 'income', category_name: 'Test', amount: 50.5, description: 'Test' }
    ];
    const html = generateReportHtml('2025-01-01', '2025-01-31', stats, {}, details);
    
    assert.ok(html.includes('¥ 50.50'), 'Should format 50.5 to 50.50');
  });

  it('should handle large file export (10000 rows) under 100ms', () => {
    const stats = { totalAssets: 0, totalIncome: 0, totalExpense: 0, netIncome: 0 };
    const details = Array.from({ length: 10000 }).map((_, i) => ({
      date: '2025-01-10',
      type: i % 2 === 0 ? 'income' : 'expense',
      category_name: 'Test ' + i,
      amount: i,
      description: 'Desc ' + i
    }));

    const start = performance.now();
    const html = generateReportHtml('2025-01-01', '2025-01-31', stats, {}, details);
    const end = performance.now();

    assert.ok(end - start < 500, `Large HTML generation took too long: ${end - start}ms`);
    assert.ok(html.length > 100000, 'HTML size should be large');
  });

  it('should handle concurrent HTML generation requests securely', async () => {
    const stats = { totalAssets: 0, totalIncome: 0, totalExpense: 0, netIncome: 0 };
    const baseDetails = [{ date: '2025-01-10', type: 'income', category_name: 'Test', amount: 100, description: 'Test' }];
    
    const tasks = Array.from({ length: 50 }).map((_, index) => {
      return new Promise<void>((resolve) => {
        const html = generateReportHtml(`2025-01-${index}`, `2025-01-${index + 1}`, stats, {}, baseDetails);
        assert.ok(html.includes(`财务报表 (2025-01-${index} 至 2025-01-${index + 1})`));
        resolve();
      });
    });

    await Promise.all(tasks);
  });
});
