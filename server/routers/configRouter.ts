import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { systemConfig, orders, tasks, users, pilotProfiles } from "../../drizzle/schema";
import { eq, and, desc, sql, gt } from "drizzle-orm";

/**
 * 配置类型定义
 */
export interface PricingConfig {
  baseServiceFee: number;       // 基础服务费
  serviceFeeRate: number;       // 服务费比例
  minServiceFee: number;        // 最低服务费
  maxServiceFee: number;        // 最高服务费
  typeFees: {                   // 不同任务类型的服务费
    spray: number;              // 植保
    transport: number;         // 运输
    [key: string]: number;
  };
}

export interface SortConfig {
  distanceWeight: number;       // 距离权重
  ratingWeight: number;         // 评分权重
  responseRateWeight: number;   // 响应率权重
  activityWeight: number;      // 活跃度权重
  completionRateWeight: number; // 完成率权重
}

/**
 * 默认配置
 */
const DEFAULT_PRICING: PricingConfig = {
  baseServiceFee: 10.0,
  serviceFeeRate: 0.1,
  minServiceFee: 5.0,
  maxServiceFee: 100.0,
  typeFees: {
    spray: 15.0,
    transport: 20.0,
  },
};

const DEFAULT_SORT: SortConfig = {
  distanceWeight: 0.4,
  ratingWeight: 0.3,
  responseRateWeight: 0.15,
  activityWeight: 0.1,
  completionRateWeight: 0.05,
};

/**
 * 配置路由 - 管理后台使用
 */
export const configRouter = router({
  /**
   * 获取定价配置
   */
  getPricingConfig: publicProcedure.query(async () => {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "pricing_config"));

    if (config) {
      return JSON.parse(config.value as string) as PricingConfig;
    }
    return DEFAULT_PRICING;
  }),

  /**
   * 更新定价配置（仅管理员）
   */
  updatePricingConfig: protectedProcedure
    .input(z.object({
      baseServiceFee: z.number().min(0),
      serviceFeeRate: z.number().min(0).max(1),
      minServiceFee: z.number().min(0),
      maxServiceFee: z.number().min(0),
      typeFees: z.record(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      // 检查管理员权限
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可修改配置" });
      }

      const configValue = JSON.stringify(input);

      const [existing] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "pricing_config"));

      if (existing) {
        await db
          .update(systemConfig)
          .set({ value: configValue, updatedAt: new Date() })
          .where(eq(systemConfig.key, "pricing_config"));
      } else {
        await db.insert(systemConfig).values({
          key: "pricing_config",
          value: configValue,
          description: "定价配置 - 服务费相关设置",
        });
      }

      return { success: true, config: input };
    }),

  /**
   * 获取排序配置
   */
  getSortConfig: publicProcedure.query(async () => {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "sort_config"));

    if (config) {
      return JSON.parse(config.value as string) as SortConfig;
    }
    return DEFAULT_SORT;
  }),

  /**
   * 更新排序配置（仅管理员）
   */
  updateSortConfig: protectedProcedure
    .input(z.object({
      distanceWeight: z.number().min(0).max(1),
      ratingWeight: z.number().min(0).max(1),
      responseRateWeight: z.number().min(0).max(1),
      activityWeight: z.number().min(0).max(1),
      completionRateWeight: z.number().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可修改配置" });
      }

      // 验证权重总和
      const total = Object.values(input).reduce((sum, v) => sum + v, 0);
      if (Math.abs(total - 1.0) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `权重总和必须为1.0，当前为${total.toFixed(2)}`,
        });
      }

      const configValue = JSON.stringify(input);

      const [existing] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "sort_config"));

      if (existing) {
        await db
          .update(systemConfig)
          .set({ value: configValue, updatedAt: new Date() })
          .where(eq(systemConfig.key, "sort_config"));
      } else {
        await db.insert(systemConfig).values({
          key: "sort_config",
          value: configValue,
          description: "排序配置 - 飞手列表排序权重",
        });
      }

      return { success: true, config: input };
    }),

  /**
   * 计算服务费
   */
  calculateServiceFee: protectedProcedure
    .input(z.object({
      taskType: z.enum(["spray", "transport"]),
      budgetAmount: z.number().min(0),
    }))
    .query(async ({ input }) => {
      const pricing = await ctx.router.createCaller({}).config.getPricingConfig();
      
      const typeFee = pricing.typeFees[input.taskType] || pricing.baseServiceFee;
      const calculatedFee = typeFee + (input.budgetAmount * pricing.serviceFeeRate);
      
      return {
        serviceFee: Math.max(
          pricing.minServiceFee,
          Math.min(pricing.maxServiceFee, calculatedFee)
        ),
        breakdown: {
          typeFee,
          percentageFee: input.budgetAmount * pricing.serviceFeeRate,
          minFee: pricing.minServiceFee,
          maxFee: pricing.maxServiceFee,
        },
      };
    }),

  /**
   * 获取飞手列表（带排序）
   */
  getSortedPilots: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().default(50), // km
      taskType: z.enum(["spray", "transport"]).optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const sortConfig = await ctx.router.createCaller({}).config.getSortConfig();

      // Haversine公式计算距离
      const distanceSelect = sql<
        number
      >`(
        6371 * acos(
          cos(radians(${input.latitude})) * cos(radians(baseLatitude)) * 
          cos(radians(baseLongitude) - radians(${input.longitude})) + 
          sin(radians(${input.latitude})) * sin(radians(baseLatitude))
        )
      )`;

      // 构建排序表达式
      // 简化版本：按距离和评分综合排序
      const pilots = await db
        .select({
          id: pilotProfiles.id,
          userId: pilotProfiles.userId,
          realName: pilotProfiles.realName,
          level: pilotProfiles.level,
          averageRating: pilotProfiles.averageRating,
          fulfillmentRate: pilotProfiles.fulfillmentRate,
          completedTasks: pilotProfiles.completedTasks,
          status: pilotProfiles.status,
          distance: distanceSelect.as("distance"),
        })
        .from(pilotProfiles)
        .leftJoin(users, eq(pilotProfiles.userId, users.id))
        .where(
          and(
            eq(pilotProfiles.status, "available"),
            sql`${distanceSelect} < ${input.radius}`
          )
        )
        .orderBy(
          // 综合评分排序（实际应用中根据权重计算）
          desc(pilotProfiles.averageRating),
          asc(sql`${distanceSelect}`)
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return pilots.map(p => ({
        ...p,
        distance: Number(p.distance?.toFixed(2)) || 0,
        sortScore: (
          sortConfig.distanceWeight * (1 / (Number(p.distance) || 1)) +
          sortConfig.ratingWeight * Number(p.averageRating) +
          sortConfig.completionRateWeight * Number(p.fulfillmentRate)
        ).toFixed(2),
      }));
    }),

  /**
   * 获取所有系统配置
   */
  getAllConfigs: protectedProcedure.query(async () => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可查看" });
    }

    const configs = await db
      .select()
      .from(systemConfig);

    return configs.reduce((acc, c) => {
      acc[c.key] = {
        value: JSON.parse(c.value as string),
        description: c.description,
        updatedAt: c.updatedAt,
      };
      return acc;
    }, {} as Record<string, any>);
  }),

  /**
   * 更新任意配置（仅管理员）
   */
  updateConfig: protectedProcedure
    .input(z.object({
      key: z.string(),
      value: z.any(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可修改配置" });
      }

      const configValue = JSON.stringify(input.value);

      const [existing] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, input.key));

      if (existing) {
        await db
          .update(systemConfig)
          .set({ 
            value: configValue, 
            description: input.description,
            updatedAt: new Date() 
          })
          .where(eq(systemConfig.key, input.key));
      } else {
        await db.insert(systemConfig).values({
          key: input.key,
          value: configValue,
          description: input.description,
        });
      }

      return { success: true };
    }),
});
