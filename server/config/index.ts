/**
 * 配置管理系统
 * 支持灵活的地图、支付、API端点配置
 */

export type MapProvider = 'google' | 'amap' | 'tencent' | 'baidu';
export type PaymentProvider = 'stripe' | 'wechat' | 'alipay';

export interface MapConfig {
  provider: MapProvider;
  apiKey: string;
  apiSecret?: string;
  enabled: boolean;
}

export interface PaymentConfig {
  provider: PaymentProvider;
  apiKey: string;
  apiSecret?: string;
  enabled: boolean;
}

export interface AppConfig {
  // 应用基本信息
  appName: string;
  appVersion: string;
  environment: 'development' | 'staging' | 'production';

  // 地图配置
  maps: {
    primary: MapProvider;
    providers: Record<MapProvider, MapConfig>;
  };

  // 支付配置
  payments: {
    primary: PaymentProvider;
    providers: Record<PaymentProvider, PaymentConfig>;
  };

  // API配置
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };

  // 登录配置
  auth: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enablePhoneLogin: boolean;
    enableWechatLogin: boolean;
    enableAlipayLogin: boolean;
    enableGoogleLogin: boolean;
  };

  // 功能开关
  features: {
    enableNotifications: boolean;
    enableAnalytics: boolean;
    enableAnomalousLoginDetection: boolean;
    enableDeviceFingerprint: boolean;
  };
}

/**
 * 默认配置
 */
const defaultConfig: AppConfig = {
  appName: 'UAV Dispatch Platform',
  appVersion: '1.0.0',
  environment: (process.env.NODE_ENV as any) || 'development',

  maps: {
    primary: 'google',
    providers: {
      google: {
        provider: 'google',
        apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        enabled: !!process.env.GOOGLE_MAPS_API_KEY,
      },
      amap: {
        provider: 'amap',
        apiKey: process.env.AMAP_API_KEY || '',
        apiSecret: process.env.AMAP_API_SECRET || '',
        enabled: !!process.env.AMAP_API_KEY,
      },
      tencent: {
        provider: 'tencent',
        apiKey: process.env.TENCENT_MAP_API_KEY || '',
        enabled: !!process.env.TENCENT_MAP_API_KEY,
      },
      baidu: {
        provider: 'baidu',
        apiKey: process.env.BAIDU_MAP_API_KEY || '',
        enabled: !!process.env.BAIDU_MAP_API_KEY,
      },
    },
  },

  payments: {
    primary: 'stripe',
    providers: {
      stripe: {
        provider: 'stripe',
        apiKey: process.env.STRIPE_SECRET_KEY || '',
        enabled: !!process.env.STRIPE_SECRET_KEY,
      },
      wechat: {
        provider: 'wechat',
        apiKey: process.env.WECHAT_PAY_MERCHANT_ID || '',
        apiSecret: process.env.WECHAT_PAY_API_KEY || '',
        enabled: !!process.env.WECHAT_PAY_MERCHANT_ID,
      },
      alipay: {
        provider: 'alipay',
        apiKey: process.env.ALIPAY_APP_ID || '',
        apiSecret: process.env.ALIPAY_PRIVATE_KEY || '',
        enabled: !!process.env.ALIPAY_APP_ID,
      },
    },
  },

  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    retries: parseInt(process.env.API_RETRIES || '3'),
  },

  auth: {
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400000'), // 24小时
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15分钟
    enablePhoneLogin: process.env.ENABLE_PHONE_LOGIN !== 'false',
    enableWechatLogin: process.env.ENABLE_WECHAT_LOGIN !== 'false',
    enableAlipayLogin: process.env.ENABLE_ALIPAY_LOGIN !== 'false',
    enableGoogleLogin: process.env.ENABLE_GOOGLE_LOGIN !== 'false',
  },

  features: {
    enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableAnomalousLoginDetection: process.env.ENABLE_ANOMALOUS_LOGIN !== 'false',
    enableDeviceFingerprint: process.env.ENABLE_DEVICE_FINGERPRINT !== 'false',
  },
};

/**
 * 配置管理器
 */
export class ConfigManager {
  private static instance: AppConfig = defaultConfig;

  /**
   * 获取完整配置
   */
  static getConfig(): AppConfig {
    return this.instance;
  }

  /**
   * 获取地图配置
   */
  static getMapConfig(provider?: MapProvider): MapConfig {
    const mapProvider = provider || this.instance.maps.primary;
    return this.instance.maps.providers[mapProvider];
  }

  /**
   * 获取支付配置
   */
  static getPaymentConfig(provider?: PaymentProvider): PaymentConfig {
    const paymentProvider = provider || this.instance.payments.primary;
    return this.instance.payments.providers[paymentProvider];
  }

  /**
   * 获取启用的地图提供商列表
   */
  static getEnabledMapProviders(): MapProvider[] {
    return Object.entries(this.instance.maps.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider as MapProvider);
  }

  /**
   * 获取启用的支付提供商列表
   */
  static getEnabledPaymentProviders(): PaymentProvider[] {
    return Object.entries(this.instance.payments.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider as PaymentProvider);
  }

  /**
   * 切换主地图提供商
   */
  static setPrimaryMapProvider(provider: MapProvider): void {
    if (this.instance.maps.providers[provider]?.enabled) {
      this.instance.maps.primary = provider;
    } else {
      throw new Error(`Map provider ${provider} is not enabled`);
    }
  }

  /**
   * 切换主支付提供商
   */
  static setPrimaryPaymentProvider(provider: PaymentProvider): void {
    if (this.instance.payments.providers[provider]?.enabled) {
      this.instance.payments.primary = provider;
    } else {
      throw new Error(`Payment provider ${provider} is not enabled`);
    }
  }

  /**
   * 更新配置
   */
  static updateConfig(config: Partial<AppConfig>): void {
    this.instance = { ...this.instance, ...config };
  }

  /**
   * 验证配置
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查至少有一个启用的地图提供商
    const enabledMaps = this.getEnabledMapProviders();
    if (enabledMaps.length === 0) {
      errors.push('No map provider is enabled');
    }

    // 检查至少有一个启用的支付提供商
    const enabledPayments = this.getEnabledPaymentProviders();
    if (enabledPayments.length === 0) {
      errors.push('No payment provider is enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ConfigManager;
