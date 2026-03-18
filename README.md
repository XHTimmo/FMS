# Studio Financial System (工作室财务管理系统)

基于 Electron + Vue 3 构建的现代化财务管理系统，专为工作室设计，提供会员管理、收支记账、财务看板等核心功能。

## 🚀 功能特性

- **数据看板 (Dashboard)**: 实时概览总资产、本月收支、近6个月趋势图及支出构成。
- **会员管理 (Members)**: 完整的会员信息录入、编辑、状态管理及联系方式追踪。
- **收支记账 (Transactions)**: 
  - 支持多账户（现金、银行卡、支付宝等）管理。
  - 自定义收支分类。
  - 自动计算账户余额。
- **本地数据存储**: 使用 SQLite 数据库，数据安全且完全本地化。
- **现代化 UI**: 基于 Element Plus 设计，支持暗黑模式（基础适配）。

## 🛠 技术栈

- **Core**: Electron, Node.js
- **Frontend**: Vue 3, TypeScript, Vite, Element Plus, ECharts, Pinia
- **Backend**: Better-SQLite3 (Local DB)
- **Tooling**: Electron-Builder

## 📦 安装与运行

### 前置要求
- Node.js v16+ (推荐 v18/v20)
- npm 或 yarn/bun

### 开发环境运行

1.  **安装依赖**
    ```bash
    npm install
    ```

2.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    此命令将同时启动 Vite 前端服务和 Electron 主进程。

### 构建生产版本

```bash
npm run build
```
构建产物将位于 `release/` 目录下。

## 🗂 项目结构

```
├── src
│   ├── main          # Electron 主进程 (Node.js)
│   │   ├── database.ts   # 数据库初始化
│   │   ├── ipc           # IPC 通信处理 (业务逻辑)
│   │   └── index.ts      # 入口文件
│   ├── preload       # 预加载脚本 (Context Bridge)
│   └── renderer      # 前端渲染进程 (Vue 3)
│       ├── components    # 公共组件 (Layout)
│       ├── router        # 路由配置
│       ├── views         # 页面视图 (Dashboard, Members, Transactions)
│       └── types.ts      # TypeScript 类型定义
├── electron-builder.json5  # 打包配置
└── package.json
```

## 📝 注意事项

- **数据库位置**: 默认存储在用户数据目录下的 `database/studio_finance.sqlite`。
  - Windows: `%APPDATA%/studio-financial-system/database/`
  - macOS: `~/Library/Application Support/studio-financial-system/database/`
- **默认账号**: 系统初始化时会自动创建 `admin` 账号（密码 `admin123`），目前版本默认直接进入系统，后续可启用登录拦截。

## 📄 许可证

MIT License
