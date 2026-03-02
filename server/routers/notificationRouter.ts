import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { notifications, users, tasks, pilotProfiles } from "../../drizzle/schema";
import { eq, and, desc, asc, sql, count, isNull } from "drizzle-orm";

/**
 * 通知类型定义
 */
const NotificationType = {
  task_assigned: "task_assigned",
  task_accepted: "task_accepted",
  task_rejected: "task_rejected",
  task_completed: "task_completed",
  task_cancelled: "task_cancelled",
  payment_received: "payment_received",
  settlement_processed: "settlement_processed",
  qualification_approved: "qualification_approved",
  qualification_rejected: "qualification_rejected",
  rating_received: "rating_received",
  system_alert: "system_alert",
  new_message: "new_message",
  contact_unlocked: "contact_unlocked",
} as const;

type NotificationType = typeof NotificationType[keyof typeof NotificationType];

/**
 * 创建通知辅助函数
 */
async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content: string,
  relatedTaskId?: number,
  relatedOrderId?: number
) {
  const result = await db.insert(notifications).values({
    userId,
    type,
    title,
    content,
    relatedTaskId: relatedTaskId || null,
    relatedOrderId: relatedOrderId || null,
  });
  return result[0].insertId;
}

/**
 * 通知路由 - 用户通知管理
 */
export const notificationRouter = router({
  /**
   * 获取通知列表
   */
  getNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        page: z.number().default(1),
        unreadOnly: z.boolean().default(false),
        type: z.enum(Object.values(NotificationType)).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, page, unreadOnly, type } = input;
      const conditions = [eq(notifications.userId, ctx.user.id)];

      if (unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }

      if (type) {
        conditions.push(eq(notifications.type, type));
      }

      const notificationList = await db
        .select()
        .from(notifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      // 获取总数
      const [total] = await db
        .select({ count: count() })
        .from(notifications)
        .where(eq(notifications.userId, ctx.user.id));

      // 获取未读数
      const [unreadCount] = await db
        .select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, false)
          )
        );

      return {
        notifications: notificationList,
        total: total?.count || 0,
        unreadCount: unreadCount?.count || 0,
        page,
        limit,
      };
    }),

  /**
   * 获取未读通知数量
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );

    return { unreadCount: result?.count || 0 };
  }),

  /**
   * 标记通知为已读
   */
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input.notificationId))
        .limit(1);

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
      }

      if (notification.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权操作" });
      }

      await db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notifications.id, input.notificationId));

      return { success: true };
    }),

  /**
   * 标记所有通知为已读
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );

    return { success: true };
  }),

  /**
   * 删除通知
   */
  deleteNotification: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input.notificationId))
        .limit(1);

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
      }

      if (notification.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权操作" });
      }

      await db
        .delete(notifications)
        .where(eq(notifications.id, input.notificationId));

      return { success: true };
    }),

  /**
   * 清空所有通知
   */
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, ctx.user.id));

    return { success: true };
  }),

  // ========== 管理员功能 ==========

  /**
   * 发送系统通知（管理员）
   */
  sendSystemNotification: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).optional(), // 指定用户，为空则发送给所有用户
        role: z.enum(["all", "customer", "pilot"]).default("all"),
        title: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { userIds, role, title, content } = input;

      let targetUserIds: number[] = [];

      if (userIds && userIds.length > 0) {
        // 指定用户
        targetUserIds = userIds;
      } else if (role === "all") {
        // 所有用户
        const allUsers = await db.select({ id: users.id }).from(users);
        targetUserIds = allUsers.map((u) => u.id);
      } else {
        // 指定角色
        const roleUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, role === "customer" ? "customer" : "pilot"));
        targetUserIds = roleUsers.map((u) => u.id);
      }

      // 批量插入通知
      const notificationData = targetUserIds.map((userId) => ({
        userId,
        type: "system_alert" as const,
        title,
        content,
      }));

      // 分批插入（每批100条）
      const batchSize = 100;
      for (let i = 0; i < notificationData.length; i += batchSize) {
        const batch = notificationData.slice(i, i + batchSize);
        await db.insert(notifications).values(batch);
      }

      return {
        success: true,
        sentCount: targetUserIds.length,
      };
    }),

  /**
   * 获取通知统计（管理员）
   */
  getNotificationStats: adminProcedure.query(async () => {
    // 按类型统计
    const typeStats = await db
      .select({
        type: notifications.type,
        count: count(),
      })
      .from(notifications)
      .groupBy(notifications.type);

    // 按已读/未读统计
    const readStats = await db
      .select({
        isRead: notifications.isRead,
        count: count(),
      })
      .from(notifications)
      .groupBy(notifications.isRead);

    const unreadCount = readStats.find((r) => r.isRead === false)?.count || 0;
    const readCount = readStats.find((r) => r.isRead === true)?.count || 0;

    return {
      total: unreadCount + readCount,
      unread: unreadCount,
      read: readCount,
      byType: typeStats,
    };
  }),

  /**
   * 通知设置 - 获取用户通知偏好
   */
  getNotificationSettings: protectedProcedure.query(async ({ ctx }) => {
    // TODO: 从用户配置中读取通知偏好
    // 暂时返回默认值
    return {
      enablePush: true,
      enableEmail: false,
      enableSms: false,
      taskNotifications: true,
      paymentNotifications: true,
      ratingNotifications: true,
      systemNotifications: true,
    };
  }),

  /**
   * 通知设置 - 更新用户通知偏好
   */
  updateNotificationSettings: protectedProcedure
    .input(
      z.object({
        enablePush: z.boolean().optional(),
        enableEmail: z.boolean().optional(),
        enableSms: z.boolean().optional(),
        taskNotifications: z.boolean().optional(),
        paymentNotifications: z.boolean().optional(),
        ratingNotifications: z.boolean().optional(),
        systemNotifications: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: 保存到用户配置表
      return { success: true, message: "设置已更新" };
    }),
});

/**
 * 导出通知创建辅助函数供其他模块使用
 */
export { createNotification, NotificationType };
