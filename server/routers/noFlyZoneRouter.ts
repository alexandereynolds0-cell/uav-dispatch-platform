import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { systemConfig } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

/**
 * 禁飞区路由 - 地图区域管理
 */
export const noFlyZoneRouter = router({
  /**
   * 获取所有禁飞区
   */
  getAllZones: publicProcedure.query(async () => {
    const zonesJson = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "no_fly_zones"))
      .limit(1);

    if (zonesJson.length === 0 || !zonesJson[0].value) {
      return [];
    }

    try {
      return JSON.parse(zonesJson[0].value);
    } catch {
      return [];
    }
  }),

  /**
   * 获取单个禁飞区
   */
  getZoneById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const zones = await this.getAllZones({} as any);
      return zones.find((z: any) => z.id === input.id) || null;
    }),

  /**
   * 添加禁飞区（管理员）
   */
  addZone: adminProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.enum(["polygon", "circle"]),
        coordinates: z.array(z.array(z.number())), // [[lng, lat], ...]
        center: z.object({
          lat: z.number(),
          lng: z.number(),
        }).optional(),
        radius: z.number().optional(), // 圆形时使用，单位：米
        riskLevel: z.enum(["low", "medium", "high", "critical"]),
        description: z.string().optional(),
        color: z.string().default("#ff0000"),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const zonesJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zones"))
        .limit(1);

      let zones: any[] = [];
      if (zonesJson.length > 0 && zonesJson[0].value) {
        try {
          zones = JSON.parse(zonesJson[0].value);
        } catch {
          zones = [];
        }
      }

      // 生成新ID
      const newZone = {
        id: `zone_${Date.now()}`,
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      zones.push(newZone);

      // 保存
      if (zonesJson.length > 0) {
        await db
          .update(systemConfig)
          .set({
            value: JSON.stringify(zones),
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.id, zonesJson[0].id));
      } else {
        await db.insert(systemConfig).values({
          key: "no_fly_zones",
          value: JSON.stringify(zones),
          description: "禁飞区配置",
        });
      }

      return { success: true, zone: newZone };
    }),

  /**
   * 更新禁飞区（管理员）
   */
  updateZone: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.enum(["polygon", "circle"]).optional(),
        coordinates: z.array(z.array(z.number())).optional(),
        center: z
          .object({
            lat: z.number(),
            lng: z.number(),
          })
          .optional(),
        radius: z.number().optional(),
        riskLevel: z
          .enum(["low", "medium", "high", "critical"])
          .optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      const zonesJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zones"))
        .limit(1);

      if (zonesJson.length === 0 || !zonesJson[0].value) {
        throw new TRPCError({ code: "NOT_FOUND", message: "禁飞区不存在" });
      }

      let zones: any[] = JSON.parse(zonesJson[0].value);
      const index = zones.findIndex((z: any) => z.id === id);

      if (index === -1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "禁飞区不存在" });
      }

      zones[index] = {
        ...zones[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(systemConfig)
        .set({
          value: JSON.stringify(zones),
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.id, zonesJson[0].id));

      return { success: true, zone: zones[index] };
    }),

  /**
   * 删除禁飞区（管理员）
   */
  deleteZone: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const zonesJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zones"))
        .limit(1);

      if (zonesJson.length === 0 || !zonesJson[0].value) {
        throw new TRPCError({ code: "NOT_FOUND", message: "禁飞区不存在" });
      }

      let zones: any[] = JSON.parse(zonesJson[0].value);
      zones = zones.filter((z: any) => z.id !== input.id);

      await db
        .update(systemConfig)
        .set({
          value: JSON.stringify(zones),
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.id, zonesJson[0].id));

      return { success: true };
    }),

  /**
   * 批量导入禁飞区（管理员）
   */
  importZones: adminProcedure
    .input(
      z.array(
        z.object({
          name: z.string(),
          type: z.enum(["polygon", "circle"]),
          coordinates: z.array(z.array(z.number())),
          center: z
            .object({
              lat: z.number(),
              lng: z.number(),
            })
            .optional(),
          radius: z.number().optional(),
          riskLevel: z.enum(["low", "medium", "high", "critical"]),
          description: z.string().optional(),
        })
      )
    )
    .mutation(async ({ input }) => {
      const zonesJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zones"))
        .limit(1);

      let existingZones: any[] = [];
      if (zonesJson.length > 0 && zonesJson[0].value) {
        try {
          existingZones = JSON.parse(zonesJson[0].value);
        } catch {
          existingZones = [];
        }
      }

      // 为新区域生成ID
      const newZones = input.map((zone) => ({
        ...zone,
        id: `zone_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        color:
          zone.riskLevel === "critical"
            ? "#ff0000"
            : zone.riskLevel === "high"
              ? "#ff6600"
              : zone.riskLevel === "medium"
                ? "#ffaa00"
                : "#ffcc00",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const allZones = [...existingZones, ...newZones];

      if (zonesJson.length > 0) {
        await db
          .update(systemConfig)
          .set({
            value: JSON.stringify(allZones),
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.id, zonesJson[0].id));
      } else {
        await db.insert(systemConfig).values({
          key: "no_fly_zones",
          value: JSON.stringify(allZones),
          description: "禁飞区配置",
        });
      }

      return {
        success: true,
        imported: newZones.length,
        total: allZones.length,
      };
    }),

  /**
   * 检查坐标是否在禁飞区内
   */
  checkLocation: publicProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
      })
    )
    .query(async ({ input }) => {
      const zonesJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zones"))
        .limit(1);

      if (zonesJson.length === 0 || !zonesJson[0].value) {
        return {
          inZone: false,
          zones: [],
        };
      }

      let zones: any[] = [];
      try {
        zones = JSON.parse(zonesJson[0].value);
      } catch {
        zones = [];
      }

      // 过滤启用的区域
      const enabledZones = zones.filter((z: any) => z.enabled);

      // 检查是否在任何区域内
      const inZones = enabledZones.filter((zone: any) => {
        if (zone.type === "polygon") {
          return isPointInPolygon([input.lng, input.lat], zone.coordinates);
        } else if (zone.type === "circle" && zone.center && zone.radius) {
          return isPointInCircle(
            [input.lng, input.lat],
            [zone.center.lng, zone.center.lat],
            zone.radius
          );
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
    }),

  /**
   * 获取禁飞区配置
   */
  getSettings: adminProcedure.query(async () => {
    const settingsJson = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "no_fly_zone_settings"))
      .limit(1);

    if (settingsJson.length === 0 || !settingsJson[0].value) {
      return {
        allowInZone: false,
        showWarning: true,
        warningTitle: "当前位置位于禁飞区内",
        warningMessage:
          "根据相关规定，该区域禁止或限制无人机飞行。请确认是否继续。",
      };
    }

    return JSON.parse(settingsJson[0].value);
  }),

  /**
   * 更新禁飞区设置
   */
  updateSettings: adminProcedure
    .input(
      z.object({
        allowInZone: z.boolean(),
        showWarning: z.boolean(),
        warningTitle: z.string(),
        warningMessage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const settingsJson = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, "no_fly_zone_settings"))
        .limit(1);

      if (settingsJson.length > 0) {
        await db
          .update(systemConfig)
          .set({
            value: JSON.stringify(input),
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.id, settingsJson[0].id));
      } else {
        await db.insert(systemConfig).values({
          key: "no_fly_zone_settings",
          value: JSON.stringify(input),
          description: "禁飞区设置",
        });
      }

      return { success: true };
    }),
});

/**
 * 判断点是否在多边形内（射线法）
 */
function isPointInPolygon(point: number[], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 判断点是否在圆形内
 */
function isPointInCircle(
  point: number[],
  center: number[],
  radius: number
): boolean {
  const [x1, y1] = point;
  const [x2, y2] = center;

  // 计算距离（米）
  const distance = getDistanceFromLatLonInMeter(y1, x1, y2, x2);

  return distance <= radius;
}

/**
 * 计算两点之间的距离（米）
 */
function getDistanceFromLatLonInMeter(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
