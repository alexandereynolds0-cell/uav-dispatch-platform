import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { orders, tasks, pilotProfiles, users, contactUnlocks } from "../../drizzle/schema";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import crypto from "crypto";

/**
 * 支付配置
 */
interface PaymentConfig {
  wechat: {
    appId: string;
    mchId: string;
    apiKey: string;
    notifyUrl: string;
  };
  alipay: {
    appId: string;
    privateKey: string;
    publicKey: string;
    notifyUrl: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
}

// 从环境变量获取配置
function getPaymentConfig(): PaymentConfig {
  return {
    wechat: {
      appId: process.env.WECHAT_APP_ID || "",
      mchId: process.env.WECHAT_MCH_ID || "",
      apiKey: process.env.WECHAT_API_KEY || "",
      notifyUrl: process.env.WECHAT_NOTIFY_URL || "",
    },
    alipay: {
      appId: process.env.ALIPAY_APP_ID || "",
      privateKey: process.env.ALIPAY_PRIVATE_KEY || "",
      publicKey: process.env.ALIPAY_PUBLIC_KEY || "",
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || "",
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    },
  };
}

/**
 * 支付路由 - 微信、支付宝、Stripe
 */
export const paymentRouter = router({
  /**
   * 创建微信支付订单
   */
  createWechatPayOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        amount: z.number(), // 单位：分
        description: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = getPaymentConfig().wechat;

      if (!config.appId || !config.mchId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "微信支付未配置",
        });
      }

      // 生成随机字符串
      const nonceStr = crypto.randomBytes(16).toString("hex");
      // 生成商户订单号
      const outTradeNo = `ORDER_${input.orderId}_${Date.now()}`;

      // 签名参数
      const signParams = {
        appid: config.appId,
        mch_id: config.mchId,
        nonce_str: nonceStr,
        body: input.description,
        out_trade_no: outTradeNo,
        total_fee: input.amount,
        spbill_create_ip: ctx.req.ip || "127.0.0.1",
        notify_url: config.notifyUrl,
        trade_type: "NATIVE",
      };

      // 生成签名
      const sign = generateWechatSign(signParams, config.apiKey);
      signParams.sign = sign;

      // TODO: 调用微信统一下单API
      // 这里返回模拟数据
      const codeUrl = `weixin://wxpay/bizpayurl?pr=${outTradeNo}`;

      // 更新订单
      await db
        .update(orders)
        .set({
          paymentMethod: "wechat",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return {
        success: true,
        codeUrl,
        outTradeNo,
      };
    }),

  /**
   * 创建支付宝支付订单
   */
  createAlipayOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        amount: z.number(), // 单位：元
        description: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = getPaymentConfig().alipay;

      if (!config.appId || !config.privateKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "支付宝支付未配置",
        });
      }

      // 生成商户订单号
      const outTradeNo = `ORDER_${input.orderId}_${Date.now()}`;

      // 支付宝SDK参数
      const bizContent = {
        out_trade_no: outTradeNo,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: input.amount,
        subject: input.description,
        body: input.description,
      };

      // TODO: 调用支付宝SDK生成支付链接
      // 这里返回模拟数据
      const payUrl = `https://openapi.alipay.com/gateway.do?biz_content=${encodeURIComponent(
        JSON.stringify(bizContent)
      )}`;

      // 更新订单
      await db
        .update(orders)
        .set({
          paymentMethod: "alipay",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return {
        success: true,
        payUrl,
        outTradeNo,
      };
    }),

  /**
   * 微信支付回调
   */
  wechatNotify: publicProcedure
    .input(z.object({}))
    .mutation(async ({ input }) => {
      // TODO: 验证微信签名
      // TODO: 更新订单状态
      // TODO: 发送通知

      return {
        success: true,
        message: "SUCCESS",
      };
    }),

  /**
   * 支付宝回调
   */
  alipayNotify: publicProcedure
    .input(z.object({}))
    .mutation(async ({ input }) => {
      // TODO: 验证支付宝签名
      // TODO: 更新订单状态
      // TODO: 发送通知

      return {
        success: true,
        message: "success",
      };
    }),

  /**
   * 查询微信支付状态
   */
  queryWechatOrder: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      }

      // TODO: 调用微信查询订单API

      return {
        status: order.status,
        paidAt: order.paidAt,
      };
    }),

  /**
   * 查询支付宝订单状态
   */
  queryAlipayOrder: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      }

      // TODO: 调用支付宝查询订单API

      return {
        status: order.status,
        paidAt: order.paidAt,
      };
    }),

  /**
   * 申请退款
   */
  refund: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        amount: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      }

      if (order.status !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "订单未支付，无法退款" });
      }

      // TODO: 调用支付平台退款API

      // 更新订单状态
      await db
        .update(orders)
        .set({
          status: "refunded",
          refundAmount: input.amount.toString(),
          refundReason: input.reason || null,
          refundedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return { success: true, message: "退款申请已提交" };
    }),

  /**
   * 获取支付方式列表
   */
  getPaymentMethods: publicProcedure.query(async () => {
    const methods = [];

    // 检查各支付方式是否配置
    const config = getPaymentConfig();

    if (config.wechat.appId && config.wechat.mchId) {
      methods.push({
        id: "wechat",
        name: "微信支付",
        icon: "/icons/wechat-pay.png",
        enabled: true,
      });
    }

    if (config.alipay.appId) {
      methods.push({
        id: "alipay",
        name: "支付宝",
        icon: "/icons/alipay.png",
        enabled: true,
      });
    }

    if (config.stripe.secretKey) {
      methods.push({
        id: "stripe",
        name: "信用卡",
        icon: "/icons/stripe.png",
        enabled: true,
      });
    }

    return methods;
  }),
});

/**
 * 生成微信支付签名
 */
function generateWechatSign(params: Record<string, string>, apiKey: string): string {
  // 1. 参数排序
  const sortedKeys = Object.keys(params).sort();
  // 2. 拼接成字符串
  const signString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  // 3. 拼接API密钥
  const signStringWithKey = `${signString}&key=${apiKey}`;
  // 4. MD5签名并转大写
  return crypto
    .createHash("md5")
    .update(signStringWithKey, "utf8")
    .digest("hex")
    .toUpperCase();
}
