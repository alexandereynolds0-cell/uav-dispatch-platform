import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, adminProcedure } from "./_core/trpc";
import { paymentRouter } from "./routers/paymentRouter";
import { dataRouter } from "./routers/dataRouter";
import { authRouter } from "./routers/authRouter";
import { adminRouter } from "./routers/adminRouter";
import { chatRouter } from "./routers/chatRouter";
import { configRouter } from "./routers/configRouter";
import { contactRouter } from "./routers/contactRouter";
import { notificationRouter } from "./routers/notificationRouter";
import { noFlyZoneRouter } from "./routers/noFlyZoneRouter";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getDb,
  getUserByOpenId,
  getPilotProfile,
  getCustomerProfile,
  getTask,
  getTasksByCustomer,
  getTasksByPilot,
  getTasksByStatus,
  getTaskPushHistory,
  getOrder,
  getOrderByTaskId,
  getTaskRating,
  getPilotRatings,
  getUserNotifications,
  getUserRiskControl,
  getSystemConfig,
} from "./db";
import {
  users,
  customerProfiles,
  pilotProfiles,
  pilotQualifications,
  pilotEquipment,
  tasks,
  taskPushHistory,
  taskExecutionData,
  taskRatings,
  orders,
  pilotSettlements,
  notifications,
  riskControls,
  systemConfig,
} from "../drizzle/schema";
import {
  getCandidatePilots,
  rankPilots,
  batchPushTask,
  calculatePilotScore,
} from "./services/schedulingService";
import { eq, and, desc } from "drizzle-orm";

// Helper to ensure user has specific role
function requireRole(allowedRoles: string[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}

// 检查坐标是否在禁飞区内
async function checkNoFlyZone(lat: number, lng: number) {
  const zonesJson = await getDb()
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "no_fly_zones"))
    .limit(1);

  if (zonesJson.length === 0 || !zonesJson[0].value) {
    return { inZone: false, zones: [] };
  }

  let zones: any[] = [];
  try {
    zones = JSON.parse(zonesJson[0].value);
  } catch {
    zones = [];
  }

  const enabledZones = zones.filter((z: any) => z.enabled);

  const inZones = enabledZones.filter((zone: any) => {
    if (zone.type === "polygon") {
      return isPointInPolygon([lng, lat], zone.coordinates);
    } else if (zone.type === "circle" && zone.center && zone.radius) {
      return isPointInCircle([lng, lat], [zone.center.lng, zone.center.lat], zone.radius);
    }
    return false;
  });

  return {
    inZone: inZones.length > 0,
    zones: inZones.map((z: any) => ({
      id: z.id,
      name: z.name,
      riskLevel: z.riskLevel,
      description: z.description,
    })),
  };
}

// 射线法判断点在多边形内
function isPointInPolygon(point: number[], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// 判断点在圆内
function isPointInCircle(point: number[], center: number[], radius: number): boolean {
  const [x1, y1] = point;
  const [x2, y2] = center;
  const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  return distance <= radius / 111000; // 近似转换
}

export const appRouter = router({
  system: systemRouter,
  payment: paymentRouter,
  data: dataRouter,
  // 认证路由 - 手机号登录、OAuth登录
  auth: authRouter,
  // 管理员路由 - 用户管理、资质审核、任务管理、统计分析
  admin: adminRouter,
  // 聊天路由 - 消息、敏感内容过滤
  chat: chatRouter,
  // 配置路由 - 定价、排序配置
  config: configRouter,
  // 联系解锁路由 - 付费获取飞手联系方式
  contact: contactRouter,
  // 通知路由 - 用户通知管理
  notification: notificationRouter,
  // 禁飞区路由 - 地图区域管理
  noFlyZone: noFlyZoneRouter,

  // ========== User Management Routes ==========
  user: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      if (userResult.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const user = userResult[0];
      let roleProfile = null;
      if (user.role === "customer") {
        roleProfile = await getCustomerProfile(user.id);
      } else if (user.role === "pilot") {
        roleProfile = await getPilotProfile(user.id);
      }
      return { user, roleProfile };
    }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          avatar: z.string().optional(),
          phone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(users)
          .set({
            name: input.name,
            avatar: input.avatar,
            phone: input.phone,
            updatedAt: new Date(),
          })
          .where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),

  // ========== Customer Routes ==========
  customer: router({
    getProfile: requireRole(["customer"]).query(async ({ ctx }) => {
      return await getCustomerProfile(ctx.user.id);
    }),
    updateProfile: requireRole(["customer"])
      .input(
        z.object({
          companyName: z.string().optional(),
          contactPerson: z.string().optional(),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const profile = await getCustomerProfile(ctx.user.id);
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(customerProfiles)
          .set({
            companyName: input.companyName,
            contactPerson: input.contactPerson,
            contactPhone: input.contactPhone,
            address: input.address,
            updatedAt: new Date(),
          })
          .where(eq(customerProfiles.userId, ctx.user.id));
        return { success: true };
      }),
    getTasks: requireRole(["customer"]).query(async ({ ctx }) => {
      return await getTasksByCustomer(ctx.user.id);
    }),
    getOrders: requireRole(["customer"]).query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, ctx.user.id))
        .orderBy(desc(orders.createdAt));
    }),
  }),

  // ========== Pilot Routes ==========
  pilot: router({
    getProfile: requireRole(["pilot"]).query(async ({ ctx }) => {
      return await getPilotProfile(ctx.user.id);
    }),
    updateProfile: requireRole(["pilot"])
      .input(
        z.object({
          serviceRadius: z.number().optional(),
          baseLatitude: z.number().optional(),
          baseLongitude: z.number().optional(),
          bankAccount: z.string().optional(),
          bankName: z.string().optional(),
          accountHolder: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const profile = await getPilotProfile(ctx.user.id);
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(pilotProfiles)
          .set({
            serviceRadius: input.serviceRadius,
            baseLatitude: input.baseLatitude?.toString(),
            baseLongitude: input.baseLongitude?.toString(),
            bankAccount: input.bankAccount,
            bankName: input.bankName,
            accountHolder: input.accountHolder,
            updatedAt: new Date(),
          })
          .where(eq(pilotProfiles.userId, ctx.user.id));
        return { success: true };
      }),
    getAvailableTasks: requireRole(["pilot"]).query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const pilot = await getPilotProfile(ctx.user.id);
      if (!pilot) return [];
      return await db.select().from(tasks).where(eq(tasks.status, "pushing"));
    }),
    getAssignedTasks: requireRole(["pilot"]).query(async ({ ctx }) => {
      return await getTasksByPilot(ctx.user.id);
    }),
    acceptTask: requireRole(["pilot"])
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const task = await getTask(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (task.status !== "pushing") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Task is no longer available" });
        }
        await db
          .update(tasks)
          .set({
            assignedPilotId: ctx.user.id,
            status: "accepted",
            assignmentTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.taskId));
        await db
          .update(taskPushHistory)
          .set({
            status: "accepted",
            responseTime: new Date(),
            responseType: "accept",
          })
          .where(and(eq(taskPushHistory.taskId, input.taskId), eq(taskPushHistory.pilotId, ctx.user.id)));
        return { success: true };
      }),
    rejectTask: requireRole(["pilot"])
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(taskPushHistory)
          .set({ status: "rejected", responseTime: new Date(), responseType: "reject" })
          .where(and(eq(taskPushHistory.taskId, input.taskId), eq(taskPushHistory.pilotId, ctx.user.id)));
        return { success: true };
      }),
    getRatings: requireRole(["pilot"]).query(async ({ ctx }) => {
      return await getPilotRatings(ctx.user.id);
    }),
  }),

  // ========== Task Routes ==========
  task: router({
    getTask: publicProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getTask(input.taskId);
      }),
    // 创建任务时检查禁飞区
    create: requireRole(["customer"])
      .input(
        z.object({
          taskType: z.enum(["spray", "transport"]),
          title: z.string(),
          description: z.string().optional(),
          location: z.string(),
          latitude: z.number(),
          longitude: z.number(),
          area: z.number().optional(),
          weight: z.number().optional(),
          estimatedDuration: z.number().optional(),
          requiredEquipment: z.string().optional(),
          specialRequirements: z.string().optional(),
          scheduledDate: z.date(),
          scheduledEndDate: z.date().optional(),
          timeWindow: z.string().optional(),
          budgetAmount: z.number(),
          forceCreate: z.boolean().default(false), // 强制在禁飞区创建
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 检查禁飞区
        const noFlyCheck = await checkNoFlyZone(input.latitude, input.longitude);
        
        // 获取设置
        const settingsJson = await getDb()
          .select()
          .from(systemConfig)
          .where(eq(systemConfig.key, "no_fly_zone_settings"))
          .limit(1);
        
        let settings = {
          allowInZone: false,
          showWarning: true,
        };
        if (settingsJson.length > 0 && settingsJson[0].value) {
          try {
            settings = JSON.parse(settingsJson[0].value);
          } catch {}
        }
        
        // 如果在禁飞区内且不允许创建，返回警告
        if (noFlyCheck.inZone && !settings.allowInZone && !input.forceCreate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "当前位置位于禁飞区内",
            data: {
              noFlyWarning: true,
              zones: noFlyCheck.zones,
              canForceCreate: settings.allowInZone,
            },
          });
        }
        
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const result = await db.insert(tasks).values({
          customerId: ctx.user.id,
          taskType: input.taskType,
          title: input.title,
          description: input.description,
          location: input.location,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          area: input.area?.toString(),
          weight: input.weight?.toString(),
          estimatedDuration: input.estimatedDuration,
          requiredEquipment: input.requiredEquipment,
          specialRequirements: input.specialRequirements,
          scheduledDate: input.scheduledDate,
          scheduledEndDate: input.scheduledEndDate,
          timeWindow: input.timeWindow,
          budgetAmount: input.budgetAmount.toString(),
          status: "draft",
        });
        
        return { 
          taskId: result[0].insertId,
          noFlyWarning: noFlyCheck.inZone ? noFlyCheck.zones : null
        };
      }),
    getByStatus: requireRole(["admin"])
      .input(z.object({ status: z.string() }))
      .query(async ({ input }) => {
        return await getTasksByStatus(input.status);
      }),
    approve: requireRole(["admin"])
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const task = await getTask(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        await db
          .update(tasks)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(tasks.id, input.taskId));
        return { success: true };
      }),
    startDispatch: requireRole(["admin"])
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const task = await getTask(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        const candidates = await getCandidatePilots(task.taskType);
        if (candidates.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No available pilots for this task" });
        }
        const rankedPilots = await rankPilots(
          candidates,
          input.taskId,
          parseFloat(task.latitude.toString()),
          parseFloat(task.longitude.toString()),
          task.taskType,
          task.area ? parseFloat(task.area.toString()) : null,
          task.weight ? parseFloat(task.weight.toString()) : null
        );
        await batchPushTask(input.taskId, rankedPilots);
        await db
          .update(tasks)
          .set({
            status: "pushing",
            currentBatchNumber: 1,
            lastPushTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.taskId));
        return { success: true, pilotCount: rankedPilots.length };
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          status: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const task = await getTask(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && task.customerId !== ctx.user.id && task.assignedPilotId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db
          .update(tasks)
          .set({ status: input.status as any, updatedAt: new Date() })
          .where(eq(tasks.id, input.taskId));
        return { success: true };
      }),
  }),

});

export type AppRouter = typeof appRouter;
