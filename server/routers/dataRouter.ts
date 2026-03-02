import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure, requireRole } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import {
  taskExecutionData,
  taskRatings,
  riskControls,
  systemConfig,
  tasks,
  pilotProfiles,
  orders,
  users,
  notifications,
} from "../../drizzle/schema";
import { eq, and, desc, asc, sql, count, gt, gte, lte, between } from "drizzle-orm";
import { makeRequest, type LatLng } from "../_core/map";

/**
 * 数据路由 - 飞行数据、评分、风控、配置、地图、分析报表
 */
export const dataRouter = router({
  // ========== 飞行数据 ==========

  /**
   * 上传飞行数据
   */
  uploadFlightData: requireRole(["pilot"])
    .input(
      z.object({
        taskId: z.number(),
        flightLogUrl: z.string().optional(),
        flightDuration: z.number().optional(),
        actualArea: z.number().optional(),
        actualDistance: z.number().optional(),
        flightPath: z.string().optional(),
        photoUrls: z.array(z.string()).optional(),
        photoCount: z.number().optional(),
        arrivalTime: z.date().optional(),
        departureTime: z.date().optional(),
        completionTime: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pilotProfile = await db.query.pilotProfiles.findFirst({
        where: eq(pilotProfiles.userId, ctx.user.id),
      });

      if (!pilotProfile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "飞手资料不存在" });
      }

      const result = await db.insert(taskExecutionData).values({
        taskId: input.taskId,
        pilotId: pilotProfile.id,
        flightLogUrl: input.flightLogUrl || null,
        flightDuration: input.flightDuration || null,
        actualArea: input.actualArea?.toString() || null,
        actualDistance: input.actualDistance?.toString() || null,
        flightPath: input.flightPath || null,
        photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
        photoCount: input.photoCount || 0,
        arrivalTime: input.arrivalTime || null,
        departureTime: input.departureTime || null,
        completionTime: input.completionTime || null,
        notes: input.notes || null,
      });

      return { success: true, id: result[0].insertId };
    }),

  /**
   * 获取任务执行数据
   */
  getExecutionData: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [data] = await db
        .select()
        .from(taskExecutionData)
        .where(eq(taskExecutionData.taskId, input.taskId))
        .limit(1);

      return data || null;
    }),

  // ========== 评分 ==========

  /**
   * 评价任务
   */
  rateTask: requireRole(["customer"])
    .input(
      z.object({
        taskId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        qualityScore: z.number().min(1).max(5).optional(),
        timelinessScore: z.number().min(1).max(5).optional(),
        communicationScore: z.number().min(1).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId))
        .limit(1);

      if (!task || task.customerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权评价此任务" });
      }

      if (!task.assignedPilotId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "任务未分配飞手" });
      }

      // 检查是否已评价
      const [existing] = await db
        .select()
        .from(taskRatings)
        .where(eq(taskRatings.taskId, input.taskId))
        .limit(1);

      if (existing) {
        // 更新评价
        await db
          .update(taskRatings)
          .set({
            rating: input.rating,
            comment: input.comment || null,
            qualityScore: input.qualityScore || null,
            timelinessScore: input.timelinessScore || null,
            communicationScore: input.communicationScore || null,
            updatedAt: new Date(),
          })
          .where(eq(taskRatings.id, existing.id));
      } else {
        // 创建评价
        await db.insert(taskRatings).values({
          taskId: input.taskId,
          customerId: ctx.user.id,
          pilotId: task.assignedPilotId,
          rating: input.rating,
          comment: input.comment || null,
          qualityScore: input.qualityScore || null,
          timelinessScore: input.timelinessScore || null,
          communicationScore: input.communicationScore || null,
        });
      }

      // 更新飞手评分
      const ratings = await db
        .select({ rating: taskRatings.rating })
        .from(taskRatings)
        .where(eq(taskRatings.pilotId, task.assignedPilotId));

      if (ratings.length > 0) {
        const avgRating =
          ratings.reduce((sum, r) => sum + Number(r.rating), 0) /
          ratings.length;
        await db
          .update(pilotProfiles)
          .set({
            averageRating: avgRating.toFixed(2),
            totalScore: (avgRating * ratings.length).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(pilotProfiles.id, task.assignedPilotId));
      }

      return { success: true };
    }),

  /**
   * 获取任务评价
   */
  getRating: publicProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      const [rating] = await db
        .select()
        .from(taskRatings)
        .where(eq(taskRatings.taskId, input.taskId))
        .limit(1);

      return rating || null;
    }),

  // ========== 风控 ==========

  /**
   * 创建风控记录
   */
  createRiskControl: requireRole(["admin"])
    .input(
      z.object({
        userId: z.number(),
        riskType: z.enum([
          "fraud",
          "safety_violation",
          "quality_issue",
          "payment_default",
          "complaint",
        ]),
        severity: z.enum(["low", "medium", "high", "critical"]).default(
          "medium"
        ),
        description: z.string(),
        evidence: z.any().optional(),
        action: z
          .enum(["warning", "suspension", "blacklist"])
          .default("warning"),
        actionDuration: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await db.insert(riskControls).values({
        userId: input.userId,
        riskType: input.riskType,
        severity: input.severity,
        description: input.description,
        evidence: input.evidence ? JSON.stringify(input.evidence) : null,
        status: "active",
        action: input.action,
        actionDuration: input.actionDuration || null,
      });

      return { success: true, id: result[0].insertId };
    }),

  /**
   * 获取用户风控记录
   */
  getUserRiskControls: requireRole(["admin"])
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return await db
        .select()
        .from(riskControls)
        .where(eq(riskControls.userId, input.userId))
        .orderBy(desc(riskControls.createdAt));
    }),

  /**
   * 解决风控记录
   */
  resolveRiskControl: requireRole(["admin"])
    .input(
      z.object({
        riskControlId: z.number(),
        resolution: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(riskControls)
        .set({
          status: "resolved",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(riskControls.id, input.riskControlId));

      return { success: true };
    }),

  // ========== 配置 ==========

  /**
   * 获取配置
   */
  getConfig: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const [config] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, input.key))
        .limit(1);

      return config || null;
    }),

  /**
   * 获取所有配置
   */
  getAllConfigs: requireRole(["admin"]).query(async () => {
    return await db.select().from(systemConfig);
  }),

  /**
   * 更新配置
   */
  updateConfig: requireRole(["admin"])
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, input.key))
        .limit(1);

      if (existing) {
        await db
          .update(systemConfig)
          .set({
            value: input.value,
            description: input.description || existing.description,
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.id, existing.id));
      } else {
        await db.insert(systemConfig).values({
          key: input.key,
          value: input.value,
          description: input.description || null,
        });
      }

      return { success: true };
    }),

  // ========== 地图功能 ==========

  /**
   * 地址转坐标（地理编码）
   */
  geocode: publicProcedure
    .input(z.object({ address: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await makeRequest<any>("/maps/api/geocode/json", {
          address: input.address,
        });

        if (result.results && result.results.length > 0) {
          const location = result.results[0].geometry.location;
          return {
            lat: location.lat,
            lng: location.lng,
            formattedAddress: result.results[0].formatted_address,
          };
        }
        return null;
      } catch (error) {
        console.error("[Map] Geocode failed:", error);
        return null;
      }
    }),

  /**
   * 坐标转地址（逆地理编码）
   */
  reverseGeocode: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(async ({ input }) => {
      try {
        const result = await makeRequest<any>("/maps/api/geocode/json", {
          latlng: `${input.lat},${input.lng}`,
        });

        if (result.results && result.results.length > 0) {
          return {
            formattedAddress: result.results[0].formatted_address,
            placeId: result.results[0].place_id,
          };
        }
        return null;
      } catch (error) {
        console.error("[Map] Reverse geocode failed:", error);
        return null;
      }
    }),

  /**
   * 计算两点间距离
   */
  calculateDistance: publicProcedure
    .input(
      z.object({
        origins: z.array(
          z.object({
            lat: z.number(),
            lng: z.number(),
          })
        ),
        destinations: z.array(
          z.object({
            lat: z.number(),
            lng: z.number(),
          })
        ),
        mode: z.enum(["driving", "walking", "bicycling"]).default(
          "driving"
        ),
      })
    )
    .query(async ({ input }) => {
      try {
        const origins = input.origins
          .map((o) => `${o.lat},${o.lng}`)
          .join("|");
        const destinations = input.destinations
          .map((d) => `${d.lat},${d.lng}`)
          .join("|");

        const result = await makeRequest<any>(
          "/maps/api/distancematrix/json",
          {
            origins,
            destinations,
            mode: input.mode,
            units: "metric",
          }
        );

        return result.rows.map((row: any) => ({
          elements: row.elements.map((element: any) => ({
            distance: element.distance?.text,
            distanceValue: element.distance?.value,
            duration: element.duration?.text,
            durationValue: element.duration?.value,
          })),
        }));
      } catch (error) {
        console.error("[Map] Distance calculation failed:", error);
        return null;
      }
    }),

  /**
   * 路径规划
   */
  getDirections: publicProcedure
    .input(
      z.object({
        origin: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
        destination: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
        mode: z.enum(["driving", "walking", "bicycling"]).default(
          "driving"
        ),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await makeRequest<any>("/maps/api/directions/json", {
          origin: `${input.origin.lat},${input.origin.lng}`,
          destination: `${input.destination.lat},${input.destination.lng}`,
          mode: input.mode,
        });

        if (result.routes && result.routes.length > 0) {
          const route = result.routes[0];
          return {
            overviewPolyline: route.overview_polyline.points,
            bounds: route.bounds,
            legs: route.legs.map((leg: any) => ({
              distance: leg.distance?.text,
              distanceValue: leg.distance?.value,
              duration: leg.duration?.text,
              durationValue: leg.duration?.value,
              startAddress: leg.start_address,
              endAddress: leg.end_address,
              steps: leg.steps.map((step: any) => ({
                distance: step.distance?.text,
                duration: step.duration?.text,
                htmlInstructions: step.html_instructions,
                polyline: step.polyline.points,
              })),
            })),
          };
        }
        return null;
      } catch (error) {
        console.error("[Map] Directions failed:", error);
        return null;
      }
    }),

  /**
   * 搜索附近地点
   */
  nearbySearch: publicProcedure
    .input(
      z.object({
        location: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
        radius: z.number().default(5000),
        keyword: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await makeRequest<any>(
          "/maps/api/place/nearbysearch/json",
          {
            location: `${input.location.lat},${input.location.lng}`,
            radius: input.radius,
            keyword: input.keyword,
            type: input.type,
          }
        );

        return result.results.map((place: any) => ({
          name: place.name,
          placeId: place.place_id,
          location: place.geometry?.location,
          address: place.vicinity,
          rating: place.rating,
          types: place.types,
        }));
      } catch (error) {
        console.error("[Map] Nearby search failed:", error);
        return [];
      }
    }),

  // ========== 数据分析报表 ==========

  /**
   * 获取订单统计报表
   */
  getOrderReport: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate, groupBy } = input;

      // 构建日期格式
      const dateFormat = {
        day: "%Y-%m-%d",
        week: "%Y-W%V",
        month: "%Y-%m",
      }[groupBy];

      // 查询订单统计
      const orderStats = await db
        .select({
          date: sql<string>`DATE_FORMAT(${orders.createdAt}, '${dateFormat}')`,
          count: count(),
          totalAmount: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
          platformFee: sql<number>`COALESCE(SUM(${orders.platformFee}), 0)`,
        })
        .from(orders)
        .groupBy(sql`DATE_FORMAT(${orders.createdAt}, '${dateFormat}')`)
        .orderBy(sql`DATE_FORMAT(${orders.createdAt}, '${dateFormat}')`);

      // 如果有日期范围，过滤结果
      let filteredStats = orderStats;
      if (startDate && endDate) {
        filteredStats = orderStats.filter((stat) => {
          const statDate = new Date(stat.date);
          return statDate >= startDate && statDate <= endDate;
        });
      }

      return filteredStats;
    }),

  /**
   * 获取任务统计报表
   */
  getTaskReport: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        taskType: z.enum(["spray", "transport"]).optional(),
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate, taskType, groupBy } = input;

      const dateFormat = {
        day: "%Y-%m-%d",
        week: "%Y-W%V",
        month: "%Y-%m",
      }[groupBy];

      // 构建查询条件
      const conditions = [];
      if (taskType) {
        conditions.push(eq(tasks.taskType, taskType));
      }

      const taskStats = await db
        .select({
          date: sql<string>`DATE_FORMAT(${tasks.createdAt}, '${dateFormat}')`,
          taskType: tasks.taskType,
          count: count(),
        })
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`DATE_FORMAT(${tasks.createdAt}, '${dateFormat}'), ${tasks.taskType}`)
        .orderBy(sql`DATE_FORMAT(${tasks.createdAt}, '${dateFormat}')`);

      return taskStats;
    }),

  /**
   * 获取飞手绩效报表
   */
  getPilotPerformanceReport: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate, limit } = input;

      // 获取飞手基本信息和统计数据
      const pilotStats = await db
        .select({
          id: pilotProfiles.id,
          realName: pilotProfiles.realName,
          level: pilotProfiles.level,
          totalTasks: pilotProfiles.totalTasks,
          completedTasks: pilotProfiles.completedTasks,
          fulfillmentRate: pilotProfiles.fulfillmentRate,
          averageRating: pilotProfiles.averageRating,
        })
        .from(pilotProfiles)
        .orderBy(desc(pilotProfiles.completedTasks))
        .limit(limit);

      // 获取每个飞手的收入
      const pilotEarnings = await db
        .select({
          pilotId: orders.pilotId,
          totalEarnings: sql<number>`COALESCE(SUM(${orders.totalAmount} - ${orders.platformFee}), 0)`,
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(
            orders.pilotId.isNotNull(),
            startDate ? gte(orders.createdAt, startDate) : undefined,
            endDate ? lte(orders.createdAt, endDate) : undefined
          )
        )
        .groupBy(orders.pilotId);

      // 合并数据
      return pilotStats.map((pilot) => {
        const earnings = pilotEarnings.find(
          (e) => e.pilotId === pilot.id
        );
        return {
          ...pilot,
          totalEarnings: earnings?.totalEarnings || 0,
          orderCount: earnings?.orderCount || 0,
        };
      });
    }),

  /**
   * 获取客户统计报表
   */
  getCustomerReport: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate, limit } = input;

      // 获取客户任务统计
      const customerStats = await db
        .select({
          customerId: tasks.customerId,
          taskCount: count(),
        })
        .from(tasks)
        .groupBy(tasks.customerId)
        .orderBy(sql`COUNT(*)`)
        .limit(limit);

      // 获取客户信息和消费统计
      const result = await Promise.all(
        customerStats.map(async (stat) => {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, stat.customerId))
            .limit(1);

          const spending = await db
            .select({
              totalSpent: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
            })
            .from(orders)
            .where(eq(orders.customerId, stat.customerId));

          return {
            customerId: stat.customerId,
            customerName: user?.name,
            customerPhone: user?.phone,
            taskCount: stat.taskCount,
            totalSpent: spending[0]?.totalSpent || 0,
          };
        })
      );

      return result;
    }),

  /**
   * 获取运营概况
   */
  getOverview: adminProcedure.query(async () => {
    // 今日数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders] = await db
      .select({
        count: count(),
        amount: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, today));

    const [todayTasks] = await db
      .select({
        count: count(),
      })
      .from(tasks)
      .where(
        and(
          gte(tasks.createdAt, today),
          eq(tasks.status, "completed")
        )
      );

    // 本月数据
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthOrders] = await db
      .select({
        count: count(),
        amount: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        platformFee: sql<number>`COALESCE(SUM(${orders.platformFee}), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, monthStart));

    // 总计数据
    const [totalStats] = await db
      .select({
        totalUsers: sql<number>`COUNT(DISTINCT ${users.id})`,
        totalPilots: sql<number>`COUNT(DISTINCT ${pilotProfiles.id})`,
        totalTasks: sql<number>`COUNT(DISTINCT ${tasks.id})`,
        completedTasks: sql<number>`COUNT(DISTINCT CASE WHEN ${tasks.status} = 'completed' THEN ${tasks.id} END)`,
      })
      .from(users)
      .leftJoin(pilotProfiles, eq(users.id, pilotProfiles.userId))
      .leftJoin(tasks, eq(users.id, tasks.customerId));

    return {
      today: {
        orderCount: todayOrders?.count || 0,
        orderAmount: todayOrders?.amount || 0,
        completedTasks: todayTasks?.count || 0,
      },
      month: {
        orderCount: monthOrders?.count || 0,
        orderAmount: monthOrders?.amount || 0,
        platformFee: monthOrders?.platformFee || 0,
      },
      total: {
        users: totalStats?.totalUsers || 0,
        pilots: totalStats?.totalPilots || 0,
        tasks: totalStats?.totalTasks || 0,
        completedTasks: totalStats?.completedTasks || 0,
      },
    };
  }),
});
