# 🚁 无人机飞手调度平台

> 一个专业的无人机服务交易平台，连接客户与飞手

## ✨ 功能特点

| 角色 | 功能 |
|------|------|
| 👤 客户 | 发布任务、支付费用、评价飞手、联系飞手 |
| 🚁 飞手 | 实名认证、接单、作业上报、收益提现 |
| ⚙️ 管理员 | 用户管理、定价配置、排序配置、审核管理 |

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户端 (App)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  客户App    │  │   飞手App    │  │  管理后台    │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼───────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                    后端 API (Node.js)                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 认证服务 │ │ 任务服务 │ │ 支付服务 │ │ 聊天服务 │      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘      │
└───────┼───────────┼───────────┼───────────┼────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────────┬──────────────┬──────────────┬───────────┐
│   MySQL     │    Redis     │    Stripe    │    S3     │
│  (数据库)    │   (缓存)     │   (支付)    │  (文件)   │
└──────────────┴──────────────┴──────────────┴───────────┘
```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/greasebig/uav-dispatch-platform.git
cd uav-dispatch-platform
```

### 2. 安装依赖

```bash
# 安装 Node.js (如果没有)
# 推荐使用 nvm: https://github.com/nvm-sh/nvm

# 方案 A：已安装 pnpm
pnpm install

# 方案 B：Windows / 新机器没装 pnpm
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install
```

### Windows 一键启动（推荐）

如果你在 PowerShell 里遇到 `pnpm` 找不到，可以直接运行仓库自带脚本：

```powershell
.\scripts\windows\start-dev.ps1
```

或者双击：

```bat
scripts\windows\start-dev.bat
```

这个脚本会按顺序自动尝试：
1. 直接使用已安装的 `pnpm`
2. 用 `corepack` 自动启用 `pnpm`
3. 再不行就用 `npx pnpm` 临时执行

### Windows 总启动脚本（后端 + Electron）

如果你想“一次启动后端并自动打开桌面端”，请使用：

```powershell
.\scripts\windows\start-app.ps1
```

或者：

```bat
scripts\windows\start-app.bat
```

行为如下：
- 先启动后端开发服务器
- 自动轮询 `http://127.0.0.1:3000/api/health`
- 如果仓库里已经有新编译出来的 `.exe`，优先打开该 `.exe`
- 如果还没有 `.exe`，就自动启动 `electron-client` 的开发版 Electron

如果你已经安装好了某个特定 EXE，也可以手动指定路径：

```powershell
.\scripts\windows\start-app.ps1 -ElectronExePath "C:\path\to\UAV-Dispatch-Platform.exe"
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL=mysql://user:password@localhost:3306/uav_dispatch

# Stripe支付 (去 https://stripe.com 注册)
STRIPE_SECRET_KEY=sk_test_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Manus登录 (可选)
MANUS_CLIENT_ID=xxx
MANUS_CLIENT_SECRET=xxx

# 前端地址
FRONTEND_URL=http://localhost:5173
```

### 4. 初始化数据库

```bash
pnpm db:push
```

### 5. 启动开发

```bash
pnpm dev
```

访问 http://localhost:3000

## 📱 使用流程

### 客户使用流程
```
1. 注册/登录 → 2. 发布任务 → 3. 支付费用 → 
4. 获取飞手联系方式 → 5. 私下沟通 → 6. 确认完成 → 7. 评价
```

### 飞手使用流程
```
1. 注册 → 2. 实名认证 → 3. 上传资质 → 4. 等待审核 → 
5. 抢单/接单 → 6. 现场作业 → 7. 上传结果 → 8. 等待验收 → 9. 收款
```

## ⚙️ 管理后台配置

启动后访问 `/admin` 或 `/settings`：

### 定价配置
- 基础服务费
- 服务费比例
- 不同任务类型费用

### 排序配置
- 距离权重
- 评分权重
- 响应率权重
- 活跃度权重
- 完成率权重

## 🔧 常见问题

### Q: 数据库连接失败
A: 确保MySQL已启动，DATABASE_URL正确

### Q: 支付无法使用
A: 去Stripe官网申请测试密钥，填入环境变量

### Q: 如何开启手机号登录
A: 需要配置短信验证码服务（如阿里云短信、腾讯云短信）

## 📂 项目结构

```
uav-dispatch-platform/
├── client/           # React前端
│   └── src/
│       ├── pages/    # 页面组件
│       └── lib/     # 工具函数
├── server/           # Node.js后端
│   └── routers/     # API路由
├── drizzle/         # 数据库模型
└── package.json     # 项目配置
```

## 🐛 问题反馈

- [GitHub Issues](https://github.com/greasebig/uav-dispatch-platform/issues)

## 📄 许可证

MIT License

---

**开发日期**: 2026年3月
**版本**: 1.1.0


## 🖥️ Electron 桌面端说明

`electron-client` 里的 EXE 只是**桌面壳**，它需要连接一个正在运行的后端/Web 服务。

- `Backend Server URL` 指的是 **你自己的 UAV Dispatch Platform 服务地址**，不是第三方平台地址。
- 如果你在本机运行本仓库，默认填写 `http://127.0.0.1:3000` 即可。
- 正确启动顺序：
  1. 在项目根目录执行 `pnpm install`
  2. 执行 `pnpm dev`
  3. 如果 Windows 没装 `pnpm`，直接运行 `scripts\windows\start-dev.bat` 或 `.\scripts\windows\start-dev.ps1`
  4. 如果你想一键同时拉起后端和桌面端，直接运行 `scripts\windows\start-app.bat` 或 `.\scripts\windows\start-app.ps1`
  5. 看到 `Server running on http://localhost:3000/` 后，再打开 Electron EXE；或者让总启动脚本自动打开它

现在桌面端会先访问 `GET /api/health` 检查服务是否在线；如果后端没启动，会显示内置提示页，而不是直接空白。
