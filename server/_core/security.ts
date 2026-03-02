import { TRPCError } from "@trpc/server";
import type { MiddlewareOptions } from "../_core/trpc";

/**
 * 安全中间件 - 提供速率限制、IP过滤等功能
 */

// 简单的内存存储（生产环境应使用Redis）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 速率限制配置
const RATE_LIMIT_CONFIG = {
  // 每个IP每分钟允许的请求数
  global: { limit: 100, windowMs: 60 * 1000 },
  // 登录相关接口
  auth: { limit: 10, windowMs: 60 * 1000 },
  // 发送短信
  sms: { limit: 5, windowMs: 60 * 1000 },
  // API请求
  api: { limit: 200, windowMs: 60 * 1000 },
};

type RateLimitType = keyof typeof RATE_LIMIT_CONFIG;

/**
 * 速率限制中间件
 */
export function rateLimitMiddleware(type: RateLimitType = "global") {
  return async ({ ctx, next }: MiddlewareOptions) => {
    const ip = ctx.req.ip || "unknown";
    const config = RATE_LIMIT_CONFIG[type];
    const key = `${ip}:${type}`;
    const now = Date.now();

    // 获取或初始化记录
    let record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + config.windowMs };
      rateLimitStore.set(key, record);
    }

    // 检查限制
    if (record.count >= config.limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `请求过于频繁，请${retryAfter}秒后再试`,
      });
    }

    // 增加计数
    record.count++;

    return next({ ctx });
  };
}

/**
 * IP白名单中间件（用于管理员接口）
 */
export function ipWhitelistMiddleware(allowedIPs: string[]) {
  return async ({ ctx, next }: MiddlewareOptions) => {
    const ip = ctx.req.ip || "";

    // 本地开发环境跳过检查
    if (process.env.NODE_ENV === "development") {
      return next({ ctx });
    }

    if (!allowedIPs.includes(ip)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "IP地址不在允许范围内",
      });
    }

    return next({ ctx });
  };
}

/**
 * 请求来源验证中间件
 */
export function originCheckMiddleware(allowedOrigins: string[]) {
  return async ({ ctx, next }: MiddlewareOptions) => {
    const origin = ctx.req.headers.origin || "";

    // 本地开发环境跳过检查
    if (process.env.NODE_ENV === "development") {
      return next({ ctx });
    }

    // 允许的来源为空或包含当前来源
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return next({ ctx });
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "请求来源不被允许",
    });
  };
}

/**
 * 敏感操作确认中间件
 * 用于删除、资金相关等敏感操作
 */
export function sensitiveOperationMiddleware() {
  return async ({ ctx, next }: MiddlewareOptions) => {
    // 检查用户是否完成实名认证
    // TODO: 根据实际需求实现

    // 检查用户是否设置支付密码
    // TODO: 根据实际需求实现

    return next({ ctx });
  };
}

/**
 * 账户安全检查中间件
 */
export function accountSecurityMiddleware() {
  return async ({ ctx, next }: MiddlewareOptions) => {
    // 检查账户是否被禁用
    if (ctx.user) {
      // TODO: 检查用户是否有banned字段
      // if (ctx.user.banned) {
      //   throw new TRPCError({
      //     code: "FORBIDDEN",
      //     message: "账户已被禁用",
      //   });
      // }

      // 检查账户是否有风控记录
      // TODO: 查询riskControls表
    }

    return next({ ctx });
  };
}

/**
 * 输入 sanitization 中间件
 * 防止XSS等攻击
 */
export function sanitizeInputMiddleware() {
  return async ({ ctx, next }: MiddlewareOptions) => {
    // 这个中间件应该在解析输入之后、处理器执行之前运行
    // tRPC已经做了基本的输入验证，这里可以添加额外的sanitization
    return next({ ctx });
  };
}

/**
 * 审计日志中间件
 * 记录所有管理操作
 */
export function auditLogMiddleware(action: string) {
  return async ({ ctx, next }: MiddlewareOptions) => {
    const userId = ctx.user?.id;
    const ip = ctx.req.ip || "";
    const userAgent = ctx.req.headers["user-agent"] || "";

    // 记录审计日志
    console.log(`[AUDIT] ${action} by user ${userId} from ${ip}`, {
      userAgent,
      timestamp: new Date().toISOString(),
    });

    // TODO: 存入数据库

    return next({ ctx });
  };
}

/**
 * 清理过期速率限制记录
 * 定时运行
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// 每分钟清理一次
setInterval(cleanupRateLimitStore, 60 * 1000);
