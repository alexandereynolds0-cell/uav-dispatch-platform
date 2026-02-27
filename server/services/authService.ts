import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { users, loginLogs } from '../../drizzle/schema';
// Note: bcrypt can be installed with: pnpm add bcrypt
// For password hashing in production

export interface LoginProvider {
  type: 'phone' | 'wechat' | 'alipay' | 'google' | 'email' | 'manus';
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export class AuthService {
  /**
   * 通过手机号和密码进行登录
   */
  static async loginWithPhone(phone: string, password: string) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, phone))
      .limit(1);

    if (!user.length) {
      throw new Error('User not found');
    }

    const userData = user[0];
    // 实际应用中应该存储密码哈希，这里仅作示例
    // const isValid = await bcrypt.compare(password, userData.passwordHash);
    // if (!isValid) throw new Error('Invalid password');

    return userData;
  }

  /**
   * 通过社交登录创建或更新用户
   */
  static async loginWithSocialProvider(provider: LoginProvider) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // 根据提供商类型构建openId
    const openId = `${provider.type}:${provider.id}`;

    // 查找现有用户
    let user = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);

    if (user.length > 0) {
      // 更新最后登录时间
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user[0].id));
      return user[0];
    }

    // 创建新用户
    const newUser = {
      openId,
      name: provider.name,
      email: provider.email,
      loginMethod: provider.type,
      role: 'customer' as const,
      lastSignedIn: new Date(),
    };

    await db.insert(users).values([newUser]);

    const createdUser = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);

    return createdUser[0];
  }

  /**
   * 记录登录日志
   */
  static async logLogin(
    userId: number,
    provider: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    reason?: string
  ) {
    const db = await getDb();
    if (!db) {
      console.warn('Database not available for login logging');
      return;
    }

    try {
      await db.insert(loginLogs).values({
        userId,
        provider,
        ipAddress,
        userAgent,
        success,
        failureReason: reason,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log login:', error);
    }
  }

  /**
   * 检测异常登录
   */
  static async detectAnomalousLogin(userId: number, ipAddress: string) {
    const db = await getDb();
    if (!db) return false;

    // 获取最近的登录记录
    const recentLogins = await db
      .select()
      .from(loginLogs)
      .where(and(
        eq(loginLogs.userId, userId),
        eq(loginLogs.success, true)
      ))
      .limit(5);

    if (recentLogins.length === 0) return false;

    // 检查IP地址是否与最近的登录不同
    const lastIp = recentLogins[0]?.ipAddress;
    if (lastIp && lastIp !== ipAddress) {
      // 这是一个简单的异常检测，实际应用可以使用更复杂的算法
      return true;
    }

    return false;
  }

  /**
   * 生成密码哈希 (使用bcrypt库)
   * 需要安装: pnpm add bcrypt
   */
  // static async hashPassword(password: string): Promise<string> {
  //   const bcrypt = await import('bcrypt');
  //   const saltRounds = 10;
  //   return bcrypt.hash(password, saltRounds);
  // }

  /**
   * 验证密码 (使用bcrypt库)
   * 需要安装: pnpm add bcrypt
   */
  // static async verifyPassword(password: string, hash: string): Promise<boolean> {
  //   const bcrypt = await import('bcrypt');
  //   return bcrypt.compare(password, hash);
  // }

  /**
   * 生成验证码
   */
  static generateVerificationCode(length: number = 6): string {
    return Math.random()
      .toString()
      .slice(2, 2 + length)
      .padEnd(length, '0');
  }

  /**
   * 验证手机号格式
   */
  static isValidPhoneNumber(phone: string): boolean {
    // 支持国际格式和国内格式
    const phoneRegex = /^(\+\d{1,3})?1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 验证邮箱格式
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
