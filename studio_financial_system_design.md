# 工作室财务管理系统 (Studio Financial Management System) 技术设计文档

**版本**: v1.0.0
**最后更新**: 2026-03-17

## 1. 项目简介

本系统是基于 Electron + Vue 3 构建的跨平台桌面应用程序，旨在为工作室提供一套完整的财务管理解决方案。系统沿用了 ERP v1.3.2 的成熟技术架构，但在功能深度和广度上进行了扩展，涵盖会员管理、全流程收支记账、单据数字化管理、多维度财务报表以及精细化的权限控制。

### 核心特性
- **会员费用全生命周期管理**：会员入会、缴费提醒、欠费统计、历史记录。
- **全能收支记账**：支持多账户、多币种（预留）、自定义分类、凭证关联。
- **单据管理中心**：电子发票、收据扫描件的归档、检索与关联。
- **智能财务报表**：实时生成资产负债表（简易）、收支明细表、会员缴费统计图。
- **权限与安全**：基于角色的访问控制（RBAC），操作日志全程记录，数据自动备份。
- **多用户并发支持**：支持本地多用户登录与操作隔离（未来可扩展为网络版）。

## 2. 技术架构 (Technical Architecture)

本系统采用现代化的 Electron 桌面应用架构，确保高性能与良好的用户体验。

- **运行环境**: Node.js (v20+ recommended)
- **桌面框架**: Electron (主进程/渲染进程架构，启用 Context Isolation)
- **前端框架**: Vue 3 (Composition API) + Vite
- **状态管理**: Pinia (替代 Vuex，更轻量)
- **UI 组件库**: Element Plus (暗黑模式支持)
- **数据可视化**: ECharts 5.x
- **本地数据库**: Better-SQLite3 (高性能同步/异步操作) + Knex.js (Query Builder，便于迁移和维护)
- **工具库**:
  - `dayjs`: 日期处理
  - `fs-extra`: 文件系统操作增强
  - `adm-zip`: 数据备份与导出
  - `bcryptjs`: 用户密码加密
  - `winston` / `electron-log`: 日志记录

## 3. 数据库设计 (Database Schema)

数据库文件存储于用户应用数据目录 (`userData`)，确保数据安全与隔离。

### 3.1 用户与权限 (`users`, `roles`, `permissions`)
- **`users`**
  - `id`: INTEGER (PK, Auto Increment)
  - `username`: TEXT (Unique, Not Null)
  - `password_hash`: TEXT (Not Null)
  - `role`: TEXT (Default 'staff', Enum: 'admin', 'finance', 'staff')
  - `is_active`: BOOLEAN (Default 1)
  - `created_at`: INTEGER

- **`audit_logs`** (操作审计)
  - `id`: INTEGER (PK)
  - `user_id`: INTEGER (FK -> users.id)
  - `action`: TEXT (e.g., 'CREATE_TRANSACTION', 'DELETE_MEMBER')
  - `target_id`: TEXT (Affected resource ID)
  - `details`: TEXT (JSON snapshot)
  - `ip_address`: TEXT (Optional)
  - `created_at`: INTEGER

### 3.2 会员管理 (`members`, `member_fees`)
- **`members`**
  - `id`: TEXT (UUID, PK)
  - `name`: TEXT (Not Null)
  - `contact_info`: TEXT (JSON: phone, email, wechat)
  - `join_date`: TEXT (YYYY-MM-DD)
  - `status`: TEXT (Enum: 'active', 'inactive', 'suspended')
  - `notes`: TEXT
  - `created_at`: INTEGER

- **`member_fees`** (会员费记录)
  - `id`: TEXT (UUID, PK)
  - `member_id`: TEXT (FK -> members.id)
  - `period`: TEXT (YYYY-MM or YYYY)
  - `amount`: REAL
  - `paid_date`: TEXT
  - `status`: TEXT (Enum: 'paid', 'unpaid', 'partial')
  - `transaction_id`: TEXT (FK -> transactions.id, 关联实际流水)
  - `created_at`: INTEGER

### 3.3 财务核心 (`accounts`, `categories`, `transactions`)
- **`accounts`** (资金账户)
  - `id`: INTEGER (PK)
  - `name`: TEXT (e.g., 'Cash', 'Bank ICBC', 'Alipay')
  - `type`: TEXT (Enum: 'cash', 'bank', 'online')
  - `balance`: REAL (Current balance)
  - `currency`: TEXT (Default 'CNY')

- **`categories`** (收支分类)
  - `id`: INTEGER (PK)
  - `name`: TEXT
  - `type`: TEXT (Enum: 'income', 'expense')
  - `parent_id`: INTEGER (Self-referencing FK, supports hierarchy)
  - `icon`: TEXT (Icon name)

- **`transactions`** (收支流水)
  - `id`: TEXT (UUID, PK)
  - `date`: TEXT (YYYY-MM-DD HH:mm:ss)
  - `type`: TEXT (Enum: 'income', 'expense', 'transfer')
  - `amount`: REAL
  - `account_id`: INTEGER (FK -> accounts.id)
  - `to_account_id`: INTEGER (Nullable, for transfers)
  - `category_id`: INTEGER (FK -> categories.id)
  - `description`: TEXT
  - `member_id`: TEXT (Nullable, FK -> members.id, for fee tracking)
  - `created_by`: INTEGER (FK -> users.id)
  - `created_at`: INTEGER

### 3.4 单据管理 (`vouchers`)
- **`vouchers`**
  - `id`: TEXT (UUID, PK)
  - `transaction_id`: TEXT (FK -> transactions.id)
  - `file_path`: TEXT (Relative path in app data)
  - `original_name`: TEXT
  - `file_type`: TEXT (MIME type)
  - `file_size`: INTEGER
  - `uploaded_at`: INTEGER

## 4. 模块功能详细设计

### 4.1 权限管理模块
- **登录认证**: 使用 `bcryptjs` 验证密码，支持 Session/Token 机制（在 Electron 中可简化为内存状态）。
- **角色控制**:
  - `admin`: 全权访问，管理用户、系统设置、数据备份。
  - `finance`: 记账、审核、报表查看、会员管理。
  - `staff`: 仅查看部分数据或录入草稿（视需求定）。

### 4.2 会员费用模块
- **费用生成**: 支持按月/年批量生成会员费账单。
- **缴费追踪**: 清晰展示每个会员的缴费状态（红/绿指示灯）。
- **自动关联**: 录入会员费收入时，自动更新 `member_fees` 表状态。

### 4.3 收支记账模块
- **快速记账**: 快捷键支持，智能填补上次使用的账户/分类。
- **多账户管理**: 支持账户间转账，实时计算各账户余额。
- **流水查询**: 高级筛选（时间范围、金额区间、分类、经办人、关联会员）。

### 4.4 单据管理模块
- **文件存储**: 单据文件统一哈希重命名存储，避免文件名冲突。
- **预览功能**: 支持图片 (JPG, PNG) 和 PDF 的内置预览。
- **批量导出**: 按月导出财务凭证包。

### 4.5 报表与可视化
- **概览看板**: 当月收支、账户总览、近6个月趋势图。
- **收支结构**: 饼图展示各类目占比。
- **会员统计**: 活跃会员数、缴费率统计。

## 5. API 接口设计 (IPC Communication)

前端通过 `window.electronAPI` 调用主进程方法。

### 5.1 通用模式
```typescript
// Renderer
const result = await window.electronAPI.invoke('channel:action', payload);
if (result.success) { ... } else { console.error(result.error); }
```

### 5.2 核心通道定义
- **Auth**:
  - `auth:login` (username, password) -> { user, token }
  - `auth:logout` ()
  - `auth:check` () -> user

- **Transactions**:
  - `transaction:create` (data)
  - `transaction:list` (filter)
  - `transaction:stats` (range)

- **Members**:
  - `member:create` (data)
  - `member:update` (id, data)
  - `member:fees` (memberId)

- **System**:
  - `system:backup` () -> filePath
  - `system:restore` (filePath)
  - `system:logs` ()

## 6. 安全性与稳定性

- **数据校验**: 后端（主进程）使用 `zod` 或 `joi` 进行严格的数据校验，防止脏数据入库。
- **事务处理**: 涉及资金变动和日志记录的操作必须在 `db.transaction(() => { ... })` 中执行，确保原子性。
- **异常捕获**: 全局 `process.on('uncaughtException')` 记录崩溃日志，前端显示友好的错误提示。
- **自动备份**: 每次启动或关键操作后自动备份数据库文件到 `backups/` 目录，保留最近 7 天的备份。

## 7. 开发计划

1.  **Phase 1: 基础框架搭建**
    - 初始化 Electron + Vue 3 项目
    - 配置 SQLite 数据库连接与迁移脚本
    - 实现用户登录与权限基础

2.  **Phase 2: 核心业务实现**
    - 账户与分类管理
    - 收支记账功能（CRUD）
    - 单据上传与关联

3.  **Phase 3: 会员与报表**
    - 会员信息管理与费用追踪
    - ECharts 图表集成
    - 数据看板开发

4.  **Phase 4: 优化与测试**
    - 数据导出/备份功能
    - 全局异常处理与日志
    - 单元测试 (Vitest) 与集成测试
