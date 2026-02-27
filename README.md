# 无人机飞手在线调度平台

一个专业的无人机作业服务平台，连接客户、飞手和管理员，实现智能任务调度、支付结算和数据管理。

## 🎯 核心功能

### 客户端（Customer）
- 📋 **任务发布** - 发布飞防/吊运任务，设置预算和要求
- 🗺️ **地点选择** - 使用Google Maps选择作业地点
- 📊 **任务管理** - 查看任务状态、作业结果和照片
- 💳 **支付结算** - 通过Stripe支付任务费用
- ⭐ **评价系统** - 对飞手和作业质量进行评价

### 飞手端（Pilot）
- 👤 **实名认证** - 完成身份验证和资质上传
- 📜 **资质管理** - 上传飞行执照、保险等证件
- 📱 **接单系统** - 查看推送任务并快速接单
- 📍 **位置追踪** - 实时上报位置和作业进度
- 📸 **数据上传** - 上传飞行日志、照片和轨迹数据
- 📈 **等级体系** - 初级/中级/高级/VIP四级制度

### 管理后台（Admin）
- 👥 **用户管理** - 管理客户、飞手和管理员账户
- ✅ **审核系统** - 审核飞手资质和任务
- 📊 **数据分析** - 查看平台数据和飞手表现
- 💰 **财务管理** - 管理订单、结算和保证金
- 🛡️ **风控管理** - 黑名单管理和异常监控

## 🏗️ 技术架构

### 后端
- **框架**: Express.js + tRPC
- **数据库**: MySQL + Drizzle ORM
- **认证**: Manus OAuth
- **支付**: Stripe API
- **地图**: Google Maps API

### 前端
- **框架**: React 19
- **样式**: Tailwind CSS 4
- **路由**: Wouter
- **UI组件**: shadcn/ui
- **图表**: Recharts

### 部署
- **开发**: Vite + tsx
- **构建**: esbuild
- **托管**: Manus Platform

## 📊 数据库设计

### 核心表
- **users** - 用户账户（客户、飞手、管理员）
- **tasks** - 任务信息
- **pilot_profiles** - 飞手详细信息
- **pilot_qualifications** - 飞手资质
- **orders** - 订单和支付
- **pilot_settlements** - 飞手结算
- **task_execution_data** - 作业数据（轨迹、照片）
- **task_ratings** - 任务评价
- **notifications** - 通知系统
- **risk_controls** - 风控记录

## 🚀 快速开始

### 环境要求
- Node.js 22+
- pnpm 10+
- MySQL 8.0+

### 安装依赖
```bash
pnpm install
```

### 配置环境变量
```bash
# 在 Settings → Secrets 中配置以下变量
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_FRONTEND_FORGE_API_KEY=...
VITE_FRONTEND_FORGE_API_URL=...
```

### 数据库迁移
```bash
pnpm db:push
```

### 启动开发服务器
```bash
pnpm dev
```

访问 http://localhost:3000

### 生产构建
```bash
pnpm build
pnpm start
```

## 📝 API 文档

### tRPC 路由

#### 认证 (`auth`)
- `me` - 获取当前用户信息
- `logout` - 退出登录

#### 用户 (`user`)
- `getProfile` - 获取用户资料
- `updateProfile` - 更新用户资料
- `registerPilot` - 飞手注册
- `getPilotProfile` - 获取飞手资料

#### 任务 (`task`)
- `createTask` - 创建任务
- `getTask` - 获取任务详情
- `listTasks` - 列出任务
- `updateTaskStatus` - 更新任务状态
- `assignTask` - 分配任务给飞手

#### 支付 (`payment`)
- `createTaskCheckout` - 创建支付会话
- `getOrder` - 获取订单信息
- `getCustomerOrders` - 获取客户订单

#### 数据 (`data`)
- `uploadFlightData` - 上传飞行数据
- `getExecutionData` - 获取作业数据
- `rateTask` - 评价任务

## 🔒 安全特性

- **认证**: Manus OAuth + JWT
- **授权**: 基于角色的访问控制 (RBAC)
- **支付**: PCI DSS 合规的Stripe集成
- **数据**: 加密存储和传输
- **风控**: 黑名单管理和异常监控
- **合规**: 禁飞区提示和实名认证

## 📱 响应式设计

- 移动优先设计
- 平板和桌面适配
- 暗黑模式支持
- 无障碍访问支持

## 🎨 设计系统

- **颜色**: 专业蓝色 + 优雅青色
- **字体**: Poppins (标题) + Inter (正文)
- **间距**: 8px 基础网格
- **圆角**: 0.75rem 标准半径
- **阴影**: 柔和多层阴影

## 📈 性能优化

- 代码分割和动态导入
- 图片优化和懒加载
- 缓存策略优化
- CDN 资源加速

## 🧪 测试

```bash
# 运行单元测试
pnpm test

# 运行类型检查
pnpm check

# 代码格式化
pnpm format
```

## 📚 项目结构

```
uav-dispatch-platform/
├── client/                  # 前端应用
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 可复用组件
│   │   ├── contexts/       # React上下文
│   │   ├── hooks/          # 自定义hooks
│   │   ├── lib/            # 工具函数
│   │   └── App.tsx         # 主应用
│   └── index.html          # HTML入口
├── server/                  # 后端应用
│   ├── routers/            # tRPC路由
│   ├── services/           # 业务逻辑
│   ├── db.ts               # 数据库查询
│   └── _core/              # 核心功能
├── drizzle/                # 数据库schema
├── shared/                 # 共享代码
└── package.json            # 项目配置
```

## 🔄 开发工作流

1. **创建分支**: `git checkout -b feature/xxx`
2. **开发功能**: 编写代码和测试
3. **提交变更**: `git commit -m "feat: description"`
4. **推送分支**: `git push origin feature/xxx`
5. **创建PR**: 在GitHub创建Pull Request
6. **代码审查**: 等待审查和合并

## 📖 文档

- [API文档](./docs/API.md) - 完整的API参考
- [部署指南](./docs/DEPLOYMENT.md) - 生产部署步骤
- [贡献指南](./CONTRIBUTING.md) - 贡献代码指南

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 👥 联系方式

- 问题报告: [GitHub Issues](https://github.com/greasebig/uav-dispatch-platform/issues)
- 功能建议: [GitHub Discussions](https://github.com/greasebig/uav-dispatch-platform/discussions)

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

**开发日期**: 2026年2月27日  
**版本**: 1.0.0  
**状态**: 开发中
