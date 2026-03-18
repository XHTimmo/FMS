# 部署与开发文档

## 环境要求
- Node.js (v18 或更高版本)
- npm (v9 或更高版本)
- 操作系统：Windows 10/11, macOS, Linux

## 依赖安装
1. 克隆代码库到本地：
```bash
git clone <repository_url>
cd money
```

2. 安装项目依赖：
```bash
npm install
```

## 开发运行
在本地启动开发服务器并运行 Electron 客户端：
```bash
npm run dev
```

## 构建打包
构建生产环境的安装包（根据当前操作系统打包）：
```bash
npm run build
```
打包输出文件将位于 `dist` 或相关构建目录下。

## 运行测试
执行单元测试及集成测试：
```bash
npm run test
```

## 数据存储说明
系统使用 SQLite 作为本地数据库。
- 默认数据库路径位于用户数据目录（如 macOS 的 `~/Library/Application Support/<AppName>/database/`）
- 凭证文件默认存储在同级目录的 `secure_receipts` 文件夹中。
