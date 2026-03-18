import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { getDB } from '../database';
import dayjs from 'dayjs';
import { join } from 'path';
import fs from 'fs-extra';
import ExcelJS from 'exceljs';

type PeriodType = 'year' | 'quarter' | 'month' | 'custom';

interface DashboardQuery {
  periodType?: PeriodType;
  year?: number;
  quarter?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
}

function getPeriodRange(query: DashboardQuery) {
  const now = dayjs();
  const periodType = query.periodType || 'month';
  const year = query.year || now.year();
  const quarter = query.quarter || Math.ceil((now.month() + 1) / 3);
  const month = query.month || now.month() + 1;

  if (periodType === 'year') {
    const start = dayjs(`${year}-01-01`).startOf('day');
    const end = dayjs(`${year}-12-31`).endOf('day');
    return { start, end, periodType, year, quarter, month };
  }

  if (periodType === 'quarter') {
    const startMonth = (quarter - 1) * 3 + 1;
    const start = dayjs(`${year}-${String(startMonth).padStart(2, '0')}-01`).startOf('month');
    const end = start.add(2, 'month').endOf('month');
    return { start, end, periodType, year, quarter, month };
  }

  if (periodType === 'custom' && query.startDate && query.endDate) {
    const start = dayjs(query.startDate).startOf('day');
    const end = dayjs(query.endDate).endOf('day');
    return { start, end, periodType, year, quarter, month };
  }

  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month');
  const end = start.endOf('month');
  return { start, end, periodType: 'month' as PeriodType, year, quarter, month };
}

export function generateReportHtml(startDate: string, endDate: string, stats: any, chartImages: any, details: any[]) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>财务报表</title>
      <style>
        body { font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
        h1, h2 { text-align: center; color: #2c3e50; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .summary-item { text-align: center; }
        .summary-item .label { font-size: 14px; color: #6c757d; }
        .summary-item .value { font-size: 24px; font-weight: bold; margin-top: 8px; }
        .value.income { color: #67C23A; }
        .value.expense { color: #F56C6C; }
        .chart-container { text-align: center; margin-bottom: 30px; page-break-inside: avoid; }
        .chart-container img { max-width: 100%; height: auto; border: 1px solid #ebeef5; border-radius: 4px; padding: 10px; box-shadow: 0 2px 12px 0 rgba(0,0,0,.1); }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th, td { border: 1px solid #ebeef5; padding: 12px 8px; text-align: left; }
        th { background-color: #f5f7fa; font-weight: bold; color: #909399; }
        tr:nth-child(even) { background-color: #fafafa; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .page-break { page-break-before: always; }
        .tag { padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #fff; }
        .tag.income { background-color: #67C23A; }
        .tag.expense { background-color: #F56C6C; }
      </style>
    </head>
    <body>
      <h1>财务报表 (${startDate} 至 ${endDate})</h1>
      
      <div class="summary">
        <div class="summary-item">
          <div class="label">总资产</div>
          <div class="value">¥ ${stats.totalAssets.toFixed(2)}</div>
        </div>
        <div class="summary-item">
          <div class="label">总收入</div>
          <div class="value income">¥ ${stats.totalIncome.toFixed(2)}</div>
        </div>
        <div class="summary-item">
          <div class="label">总支出</div>
          <div class="value expense">¥ ${stats.totalExpense.toFixed(2)}</div>
        </div>
        <div class="summary-item">
          <div class="label">净收支</div>
          <div class="value ${stats.netIncome >= 0 ? 'income' : 'expense'}">¥ ${stats.netIncome.toFixed(2)}</div>
        </div>
      </div>

      <div class="chart-container">
        <h2>收支趋势</h2>
        ${chartImages.trend ? `<img src="${chartImages.trend}" />` : ''}
      </div>

      <div class="chart-container">
        <h2>收入/支出构成</h2>
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 48%;">${chartImages.incomePie ? `<img src="${chartImages.incomePie}" style="width: 100%;" />` : ''}</div>
          <div style="width: 48%;">${chartImages.expensePie ? `<img src="${chartImages.expensePie}" style="width: 100%;" />` : ''}</div>
        </div>
      </div>

      <div class="page-break"></div>
      
      <h2>收支明细</h2>
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th class="text-center">类型</th>
            <th>分类</th>
            <th class="text-right">金额</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          ${details.map(row => `
            <tr>
              <td>${row.date}</td>
              <td class="text-center"><span class="tag ${row.type}">${row.type === 'income' ? '收入' : '支出'}</span></td>
              <td>${row.category_name || '-'}</td>
              <td class="text-right">¥ ${Number(row.amount).toFixed(2)}</td>
              <td>${row.description || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

interface TransactionDetailRow {
  id: number;
  date: string;
  type: string;
  amount: number;
  description: string;
  category_name: string;
}

export function registerDashboardHandlers() {
  const db = getDB();

  ipcMain.handle('dashboard:stats', async (_, query: DashboardQuery = {}) => {
    const range = getPeriodRange(query);
    const startTime = range.start.format('YYYY-MM-DD HH:mm:ss');
    const endTime = range.end.format('YYYY-MM-DD HH:mm:ss');
    const startDate = range.start.format('YYYY-MM-DD');
    const endDate = range.end.format('YYYY-MM-DD');

    const totalAssets = db.prepare('SELECT SUM(balance) as total FROM accounts').get() as { total: number };

    const periodStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions 
      WHERE date(date) BETWEEN ? AND ? AND deleted_at IS NULL
    `).get(startDate, endDate) as { income: number; expense: number };

    const trend: { label: string; income: number; expense: number }[] = [];
    if (range.periodType === 'year') {
      for (let i = 0; i < 12; i++) {
        const monthStart = dayjs(`${range.year}-${String(i + 1).padStart(2, '0')}-01`).startOf('month');
        const monthEnd = monthStart.endOf('month');
        const stat = db.prepare(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
          FROM transactions 
          WHERE date(date) BETWEEN ? AND ? AND deleted_at IS NULL
        `).get(monthStart.format('YYYY-MM-DD'), monthEnd.format('YYYY-MM-DD')) as { income: number; expense: number };
        trend.push({
          label: monthStart.format('MM月'),
          income: stat.income || 0,
          expense: stat.expense || 0
        });
      }
    } else if (range.periodType === 'quarter') {
      const startMonth = (range.quarter - 1) * 3 + 1;
      for (let i = 0; i < 3; i++) {
        const monthStart = dayjs(`${range.year}-${String(startMonth + i).padStart(2, '0')}-01`).startOf('month');
        const monthEnd = monthStart.endOf('month');
        const stat = db.prepare(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
          FROM transactions 
          WHERE date(date) BETWEEN ? AND ? AND deleted_at IS NULL
        `).get(monthStart.format('YYYY-MM-DD'), monthEnd.format('YYYY-MM-DD')) as { income: number; expense: number };
        trend.push({
          label: monthStart.format('MM月'),
          income: stat.income || 0,
          expense: stat.expense || 0
        });
      }
    } else {
      const days = range.end.diff(range.start, 'day') + 1;
      const loopDays = Math.min(days, 31);
      for (let i = 0; i < loopDays; i++) {
        const dayStart = range.start.add(i, 'day').startOf('day');
        const dayEnd = dayStart.endOf('day');
        const stat = db.prepare(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
          FROM transactions 
          WHERE date(date) BETWEEN ? AND ? AND deleted_at IS NULL
        `).get(dayStart.format('YYYY-MM-DD'), dayEnd.format('YYYY-MM-DD')) as { income: number; expense: number };
        trend.push({
          label: dayStart.format('MM-DD'),
          income: stat.income || 0,
          expense: stat.expense || 0
        });
      }
    }

    const incomeComposition = db.prepare(`
      SELECT c.name, SUM(t.amount) as value
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'income' AND date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY c.name
      ORDER BY value DESC
    `).all(startDate, endDate) as { name: string; value: number }[];

    const expenseComposition = db.prepare(`
      SELECT c.name, SUM(t.amount) as value
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY c.name
      ORDER BY value DESC
    `).all(startDate, endDate) as { name: string; value: number }[];

    const incomeItems = db.prepare(`
      SELECT c.name as category, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'income' AND date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY c.name
      ORDER BY amount DESC
    `).all(startDate, endDate) as { category: string; amount: number; count: number }[];

    const expenseItems = db.prepare(`
      SELECT c.name as category, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY c.name
      ORDER BY amount DESC
    `).all(startDate, endDate) as { category: string; amount: number; count: number }[];

    const details = db.prepare(`
      SELECT t.id, t.date, t.type, t.amount, t.description, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
      ORDER BY t.date DESC
      LIMIT 200
    `).all(startDate, endDate);

    const income = periodStats.income || 0;
    const expense = periodStats.expense || 0;

    return {
      totalAssets: totalAssets.total || 0,
      periodType: range.periodType,
      startTime,
      endTime,
      totalIncome: income,
      totalExpense: expense,
      netIncome: income - expense,
      trend,
      incomeComposition,
      expenseComposition,
      incomeItems,
      expenseItems,
      details
    };
  });

  ipcMain.handle('dashboard:save-base64-image', async (event, payload: { base64Data: string; format: 'png' | 'jpg' }) => {
    const { base64Data, format } = payload;
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      return { success: false, error: '未找到窗口上下文' };
    }

    const now = dayjs().format('YYYYMMDD_HHmmss');
    const defaultPath = join(app.getPath('downloads'), `dashboard_report_${now}.${format}`);
    const result = await dialog.showSaveDialog(senderWindow, {
      title: '保存导出图片',
      defaultPath,
      filters: format === 'png'
        ? [{ name: 'PNG 图片', extensions: ['png'] }]
        : [{ name: 'JPG 图片', extensions: ['jpg', 'jpeg'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return { success: true, filePath: result.filePath };
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Save base64 image error:', err);
      return { success: false, error: err.message || '保存图片失败' };
    }
  });

  ipcMain.handle('dashboard:export-report', async (event, payload) => {
    const { format, query, chartImages, stats } = payload;
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) return { success: false, error: '未找到窗口上下文' };

    const now = dayjs().format('YYYYMMDD_HHmmss');
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    const defaultPath = join(app.getPath('downloads'), `财务报表_${now}.${ext}`);
    
    const result = await dialog.showSaveDialog(senderWindow, {
      title: `导出 ${format.toUpperCase()} 报表`,
      defaultPath,
      filters: format === 'excel' 
        ? [{ name: 'Excel 文档', extensions: ['xlsx'] }]
        : [{ name: 'PDF 文档', extensions: ['pdf'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      // 提取全部明细数据，不受分页限制
      const range = getPeriodRange(query);
      const startDate = range.start.format('YYYY-MM-DD');
      const endDate = range.end.format('YYYY-MM-DD');
      const details = db.prepare(`
        SELECT t.id, t.date, t.type, t.amount, t.description, c.name as category_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE date(t.date) BETWEEN ? AND ? AND t.deleted_at IS NULL
        ORDER BY t.date DESC
      `).all(startDate, endDate) as TransactionDetailRow[];

      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Studio Financial System';
        workbook.created = new Date();

        // 1. 概览工作表
        const summarySheet = workbook.addWorksheet('财务概览');
        summarySheet.columns = [
          { header: '指标', key: 'metric', width: 20 },
          { header: '金额 (¥)', key: 'value', width: 20 }
        ];
        
        summarySheet.addRow({ metric: '总资产', value: stats.totalAssets });
        summarySheet.addRow({ metric: '总收入', value: stats.totalIncome });
        summarySheet.addRow({ metric: '总支出', value: stats.totalExpense });
        summarySheet.addRow({ metric: '净收支', value: stats.netIncome });

        // 样式
        summarySheet.getRow(1).font = { bold: true };
        
        // 插入图表图片
        let currentRow = 7;
        const addChart = (base64Data: string, name: string) => {
          if (!base64Data) return;
          const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
          
          summarySheet.getCell(`A${currentRow}`).value = name;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
          
          const imageId = workbook.addImage({
            base64: cleanBase64,
            extension: 'png',
          });
          summarySheet.addImage(imageId, {
            tl: { col: 0, row: currentRow },
            ext: { width: 600, height: 300 }
          });
          currentRow += 16; // 留出空间
        };

        addChart(chartImages.trend, '收支趋势');
        addChart(chartImages.compare, '收支对比');
        addChart(chartImages.incomePie, '收入构成');
        addChart(chartImages.expensePie, '支出构成');

        // 2. 明细工作表
        const detailsSheet = workbook.addWorksheet('收支明细');
        detailsSheet.columns = [
          { header: '日期', key: 'date', width: 15 },
          { header: '类型', key: 'type', width: 10 },
          { header: '分类', key: 'category', width: 15 },
          { header: '金额', key: 'amount', width: 15 },
          { header: '说明', key: 'description', width: 40 }
        ];

        detailsSheet.getRow(1).font = { bold: true };
        detailsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F2F5' }
        };

        details.forEach(row => {
          detailsSheet.addRow({
            date: row.date,
            type: row.type === 'income' ? '收入' : '支出',
            category: row.category_name,
            amount: row.amount,
            description: row.description
          });
        });

        // 金额列格式化
        detailsSheet.getColumn('amount').numFmt = '¥#,##0.00';

        await workbook.xlsx.writeFile(result.filePath);
      } else if (format === 'pdf') {
        // 创建隐藏窗口渲染 PDF
        const win = new BrowserWindow({
          show: false,
          webPreferences: { nodeIntegration: false }
        });

        const htmlContent = generateReportHtml(startDate, endDate, stats, chartImages, details);

        const tempPath = join(app.getPath('temp'), `report_${now}.html`);
        await fs.writeFile(tempPath, htmlContent, 'utf-8');
        await win.loadFile(tempPath);
        
        // 等待一下确保图片加载完成
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfData = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4'
        });

        await fs.writeFile(result.filePath, pdfData);
        // 清理临时文件
        await fs.remove(tempPath);
        win.destroy();
      }

      return { success: true, filePath: result.filePath };
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Export error:', err);
      return { success: false, error: err.message || '导出过程中发生错误', retryable: true };
    }
  });
}
