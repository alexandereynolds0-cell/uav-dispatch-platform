# 无人机飞手在线调度平台 - 完整文档

## 📋 目录
1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [快速开始](#快速开始)
4. [配置指南](#配置指南)
5. [API文档](#api文档)
6. [安全最佳实践](#安全最佳实践)
7. [故障排除](#故障排除)

---

## 项目概述

**无人机飞手在线调度平台**是一个专业级的三端协同系统，连接客户、飞手和管理员，实现智能任务调度、支付结算和数据管理。

### 核心特性
- ✅ **多种登录方式** - 手机号、微信、支付宝、Google
- ✅ **灵活的地图集成** - Google Maps、高德、腾讯、百度可插拔
- ✅ **多支付方案** - Stripe、微信支付、支付宝可插拔
- ✅ **智能调度算法** - 基于距离、能力、履约率的综合评分
- ✅ **完整的安全体系** - 登录日志、异常检测、黑名单管理
- ✅ **原生移动应用** - Flutter开发，支持Android和iOS

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express.js + tRPC + Drizzle ORM |
| 数据库 | MySQL 8.0+ |
| 前端Web | React 19 + Tailwind CSS 4 |
| 移动端 | Flutter 3.10+ |
| 认证 | Manus OAuth + JWT |
| 支付 | Stripe/微信/支付宝 |
| 地图 | Google Maps/高德/腾讯/百度 |

---

## 系统架构

### 后端架构
```
┌─────────────────────────────────────────────────┐
│           API Gateway (Express)                 │
├─────────────────────────────────────────────────┤
│  tRPC Routers (Type-safe RPC)                  │
│  ├─ Auth Router (认证)                         │
│  ├─ User Router (用户)                         │
│  ├─ Task Router (任务)                         │
│  ├─ Payment Router (支付)                      │
│  └─ Data Router (数据)                         │
├─────────────────────────────────────────────────┤
│  Services Layer (业务逻辑)                      │
│  ├─ AuthService (认证服务)                     │
│  ├─ SchedulingService (调度算法)               │
│  ├─ PaymentService (支付服务)                  │
│  └─ ConfigManager (配置管理)                   │
├─────────────────────────────────────────────────┤
│  Database Layer (Drizzle ORM)                  │
│  └─ MySQL Database                             │
└─────────────────────────────────────────────────┘
```

### 前端架构
```
┌─────────────────────────────────────────────────┐
│         Flutter Mobile App                      │
├─────────────────────────────────────────────────┤
│  Screens (页面)                                 │
│  ├─ Login Screen (登录)                        │
│  ├─ Customer Dashboard (客户仪表板)            │
│  ├─ Pilot Dashboard (飞手仪表板)               │
│  └─ Admin Dashboard (管理仪表板)               │
├─────────────────────────────────────────────────┤
│  Providers (状态管理)                           │
│  ├─ AuthProvider (认证)                        │
│  ├─ TaskProvider (任务)                        │
│  └─ PaymentProvider (支付)                     │
├─────────────────────────────────────────────────┤
│  Services (API通信)                            │
│  └─ ApiService (HTTP客户端)                    │
├─────────────────────────────────────────────────┤
│  Plugins (插件)                                 │
│  ├─ MapPlugin (地图)                           │
│  └─ PaymentPlugin (支付)                       │
└─────────────────────────────────────────────────┘
```

---

## 快速开始

### 前置条件
- Node.js 22+
- Flutter 3.10+
- MySQL 8.0+
- Git

### 后端启动

#### 1. 安装依赖
```bash
cd uav-dispatch-platform
pnpm install
```

#### 2. 配置环境变量
创建 `.env` 文件：
```bash
# 数据库
DATABASE_URL=mysql://user:password@localhost:3306/uav_dispatch

# OAuth
VITE_APP_ID=your_manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im

# Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 地图 (可选)
GOOGLE_MAPS_API_KEY=your_key
AMAP_API_KEY=your_key
TENCENT_MAP_API_KEY=your_key
BAIDU_MAP_API_KEY=your_key

# 社交登录 (可选)
WECHAT_APP_ID=your_id
WECHAT_APP_SECRET=your_secret
ALIPAY_APP_ID=your_id
ALIPAY_PRIVATE_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
```

#### 3. 数据库迁移
```bash
pnpm db:push
```

#### 4. 启动开发服务器
```bash
pnpm dev
```

访问 http://localhost:3000

### 前端启动

#### 1. 创建Flutter项目
```bash
cd uav-dispatch-mobile
flutter pub get
```

#### 2. 配置环境变量
创建 `lib/config/.env` 文件：
```
API_BASE_URL=http://localhost:3000
MAP_PROVIDER=google
GOOGLE_MAPS_API_KEY=your_key
PAYMENT_PROVIDER=stripe
STRIPE_PUBLISHABLE_KEY=your_key
```

#### 3. 启动应用
```bash
# Android
flutter run -d android

# iOS
flutter run -d ios

# Web (调试)
flutter run -d web
```

---

## 配置指南

### 地图配置

#### Google Maps
```dart
// 在 lib/config/app_config.dart 中配置
static const String mapProvider = 'google';
static const String googleMapsApiKey = 'YOUR_API_KEY';
```

**获取API密钥：**
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目
3. 启用 Maps SDK for Android/iOS
4. 创建API密钥
5. 添加到 `AndroidManifest.xml` 和 `Info.plist`

#### 高德地图
```dart
static const String mapProvider = 'amap';
static const String amapApiKey = 'YOUR_API_KEY';
```

**获取API密钥：**
1. 访问 [高德开放平台](https://lbs.amap.com)
2. 注册账号
3. 创建应用
4. 获取Web服务API密钥

#### 腾讯地图
```dart
static const String mapProvider = 'tencent';
static const String tencentMapApiKey = 'YOUR_API_KEY';
```

#### 百度地图
```dart
static const String mapProvider = 'baidu';
static const String baiduMapApiKey = 'YOUR_API_KEY';
```

### 支付配置

#### Stripe
```dart
static const String paymentProvider = 'stripe';
static const String stripePublishableKey = 'pk_test_...';
```

**配置步骤：**
1. 访问 [Stripe Dashboard](https://dashboard.stripe.com)
2. 获取Publishable Key和Secret Key
3. 配置Webhook端点：`https://yourapp.com/api/stripe/webhook`
4. 在后端配置 `STRIPE_SECRET_KEY` 和 `STRIPE_WEBHOOK_SECRET`

#### 微信支付
```dart
static const String paymentProvider = 'wechat';
static const String wechatAppId = 'YOUR_APP_ID';
```

**配置步骤：**
1. 访问 [微信商户平台](https://pay.weixin.qq.com)
2. 申请微信支付商户账号
3. 获取商户ID和API密钥
4. 在后端配置环境变量

#### 支付宝
```dart
static const String paymentProvider = 'alipay';
static const String alipayAppId = 'YOUR_APP_ID';
```

**配置步骤：**
1. 访问 [支付宝开放平台](https://open.alipay.com)
2. 创建应用
3. 获取应用ID和私钥
4. 在后端配置环境变量

### 登录方式配置

#### 手机号登录
```typescript
// 后端 server/config/index.ts
auth: {
  enablePhoneLogin: true,
  // ...
}
```

需要配置短信服务提供商（如阿里云、腾讯云等）

#### 微信登录
```typescript
auth: {
  enableWechatLogin: true,
  // ...
}
```

需要在 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 中配置

#### 支付宝登录
```typescript
auth: {
  enableAlipayLogin: true,
  // ...
}
```

需要在 `ALIPAY_APP_ID` 中配置

#### Google登录
```typescript
auth: {
  enableGoogleLogin: true,
  // ...
}
```

需要在 `GOOGLE_CLIENT_ID` 中配置

---

## API文档

### 认证API

#### 获取当前用户
```
GET /api/trpc/auth.me
Authorization: Bearer <token>

Response:
{
  "id": 1,
  "openId": "wechat:oXXXXXXXX",
  "name": "张三",
  "email": "zhangsan@example.com",
  "role": "customer",
  "loginMethod": "wechat"
}
```

#### 登出
```
POST /api/trpc/auth.logout
Authorization: Bearer <token>

Response:
{
  "success": true
}
```

#### 手机号登录
```
POST /api/trpc/auth.loginWithPhone
Content-Type: application/json

Request:
{
  "phone": "13800138000",
  "verificationCode": "123456"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "openId": "phone:13800138000",
    "name": "用户名",
    "role": "customer"
  }
}
```

#### 社交登录
```
POST /api/trpc/auth.loginWithSocialProvider
Content-Type: application/json

Request:
{
  "provider": "wechat",  // 'wechat', 'alipay', 'google'
  "providerId": "oXXXXXXXX",
  "name": "微信昵称",
  "email": "email@example.com"
}

Response:
{
  "token": "eyJhbGc...",
  "user": { ... }
}
```

### 任务API

#### 获取任务列表
```
GET /api/trpc/task.listTasks?page=1&pageSize=20&status=pending
Authorization: Bearer <token>

Response:
{
  "tasks": [
    {
      "id": 1,
      "title": "农田喷洒",
      "status": "pending",
      "budget": 5000,
      "location": { "lat": 39.9, "lng": 116.4 }
    }
  ],
  "total": 100
}
```

#### 创建任务
```
POST /api/trpc/task.createTask
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "title": "农田喷洒",
  "description": "需要喷洒农药",
  "taskType": "spray",
  "budget": 5000,
  "location": { "lat": 39.9, "lng": 116.4 },
  "area": 100,
  "deadline": "2026-03-01T00:00:00Z"
}

Response:
{
  "id": 1,
  "status": "pending",
  "createdAt": "2026-02-27T00:00:00Z"
}
```

#### 接受任务
```
POST /api/trpc/task.acceptTask
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "taskId": 1
}

Response:
{
  "success": true,
  "task": { ... }
}
```

### 支付API

#### 创建支付会话
```
POST /api/trpc/payment.createTaskCheckout
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "taskId": 1,
  "amount": 5000,
  "currency": "CNY"
}

Response:
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

#### 获取订单列表
```
GET /api/trpc/payment.getCustomerOrders?page=1&pageSize=20
Authorization: Bearer <token>

Response:
{
  "orders": [
    {
      "id": 1,
      "taskId": 1,
      "amount": 5000,
      "status": "completed",
      "createdAt": "2026-02-27T00:00:00Z"
    }
  ],
  "total": 50
}
```

---

## 安全最佳实践

### 1. 认证安全

#### 密码存储
```typescript
// 使用bcrypt加密存储密码
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hashedPassword);
```

#### Token管理
- 使用JWT存储在HttpOnly Cookie中
- 设置合理的过期时间（建议24小时）
- 实现Token刷新机制
- 维护Token黑名单

#### 登录日志
```typescript
// 记录所有登录尝试
await AuthService.logLogin(
  userId,
  'wechat',
  ipAddress,
  userAgent,
  success,
  failureReason
);

// 检测异常登录
const isAnomalous = await AuthService.detectAnomalousLogin(userId, ipAddress);
```

### 2. API安全

#### 请求验证
```typescript
// 验证输入数据
if (!AuthService.isValidPhoneNumber(phone)) {
  throw new Error('Invalid phone number');
}

if (!AuthService.isValidEmail(email)) {
  throw new Error('Invalid email');
}
```

#### 速率限制
```typescript
// 实现API速率限制，防止暴力攻击
const maxLoginAttempts = 5;
const lockoutDuration = 15 * 60 * 1000; // 15分钟
```

#### CORS配置
```typescript
// 在Express中配置CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));
```

### 3. 数据安全

#### 加密敏感数据
```typescript
// 加密存储敏感信息（如银行卡号）
const encrypted = encrypt(sensitiveData);
```

#### SQL注入防护
```typescript
// 使用参数化查询（Drizzle ORM已内置防护）
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, userInput));
```

### 4. 支付安全

#### Stripe Webhook验证
```typescript
// 验证Webhook签名
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

#### PCI DSS合规
- 不存储完整的信用卡信息
- 使用Stripe托管的支付表单
- 定期进行安全审计

### 5. 地理位置安全

#### 禁飞区检查
```typescript
// 检查任务位置是否在禁飞区
const isInNoFlyZone = await checkNoFlyZone(latitude, longitude);
if (isInNoFlyZone) {
  throw new Error('Location is in no-fly zone');
}
```

#### 位置数据隐私
- 不记录精确的个人位置
- 定期清理位置历史数据
- 用户可以选择隐私级别

### 6. 黑名单管理

#### 风险控制
```typescript
// 检查用户是否在黑名单中
const riskControl = await db
  .select()
  .from(riskControls)
  .where(and(
    eq(riskControls.userId, userId),
    eq(riskControls.status, 'active')
  ));

if (riskControl.length > 0) {
  throw new Error('User is blacklisted');
}
```

---

## 故障排除

### 常见问题

#### 1. 数据库连接失败
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**解决方案：**
- 检查MySQL服务是否运行
- 验证 `DATABASE_URL` 配置
- 检查数据库用户权限

#### 2. API请求超时
```
Error: Request timeout
```

**解决方案：**
- 检查网络连接
- 增加超时时间：`API_TIMEOUT=60000`
- 检查服务器日志

#### 3. 地图不显示
```
Error: Map API key not valid
```

**解决方案：**
- 验证API密钥配置
- 检查API配额是否超限
- 确保API已启用

#### 4. 支付失败
```
Error: Payment processing failed
```

**解决方案：**
- 检查Stripe密钥配置
- 验证Webhook端点
- 查看Stripe Dashboard日志

#### 5. 登录失败
```
Error: Authentication failed
```

**解决方案：**
- 检查OAuth配置
- 验证回调URL
- 查看登录日志

### 调试技巧

#### 启用详细日志
```typescript
// 在 server/_core/index.ts 中
if (process.env.DEBUG === 'true') {
  console.log('Detailed logs enabled');
  // 添加详细日志
}
```

#### 使用Postman测试API
1. 导入API集合
2. 设置环境变量
3. 执行请求
4. 查看响应

#### 检查数据库
```sql
-- 查看登录日志
SELECT * FROM loginLogs ORDER BY timestamp DESC LIMIT 10;

-- 查看用户信息
SELECT * FROM users WHERE id = 1;

-- 查看任务信息
SELECT * FROM tasks WHERE id = 1;
```

---

## 部署指南

### 生产环境配置

#### 后端部署
```bash
# 构建
pnpm build

# 启动
NODE_ENV=production node dist/index.js
```

#### 前端部署
```bash
# Android
flutter build apk --release

# iOS
flutter build ios --release

# Web
flutter build web --release
```

### 环境变量检查清单
- [ ] 数据库URL配置正确
- [ ] 所有API密钥已设置
- [ ] CORS配置正确
- [ ] SSL证书已配置
- [ ] 备份策略已实施
- [ ] 监控告警已配置

---

## 支持和反馈

- 📧 邮件：support@uav-dispatch.com
- 🐛 问题报告：[GitHub Issues](https://github.com/greasebig/uav-dispatch-platform/issues)
- 💬 讨论：[GitHub Discussions](https://github.com/greasebig/uav-dispatch-platform/discussions)

---

**最后更新**: 2026年2月27日  
**版本**: 1.0.0  
**许可证**: MIT
