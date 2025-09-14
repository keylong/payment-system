import { getSystemConfig, setSystemConfig } from './db-operations';

// 配置项定义
export interface ConfigDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'password' | 'json';
  defaultValue?: string;
  required?: boolean;
  category: string;
  placeholder?: string;
  validation?: (value: string) => boolean;
  sensitive?: boolean; // 是否为敏感信息，需要加密存储
}

// 系统配置定义
export const SYSTEM_CONFIGS: ConfigDefinition[] = [
  // Webhook配置
  {
    key: 'webhook.api_key',
    label: 'Webhook API密钥',
    description: 'Webhook接口认证密钥',
    type: 'password',
    required: true,
    category: 'webhook',
    placeholder: '请输入API密钥',
    sensitive: true
  },
  {
    key: 'webhook.allowed_ips',
    label: '允许的IP地址',
    description: '允许访问Webhook的IP地址列表（逗号分隔）',
    type: 'string',
    category: 'webhook',
    placeholder: '192.168.1.1,10.0.0.1'
  },

  // 商户配置
  {
    key: 'merchant.callback_url',
    label: '商户回调URL',
    description: '支付成功后发送通知的URL地址',
    type: 'url',
    category: 'merchant',
    placeholder: 'https://your-domain.com/callback'
  },
  {
    key: 'merchant.api_key',
    label: '商户API密钥',
    description: '商户回调签名验证密钥',
    type: 'password',
    category: 'merchant',
    placeholder: '请输入商户API密钥',
    sensitive: true
  },
  {
    key: 'merchant.name',
    label: '商户名称',
    description: '商户显示名称',
    type: 'string',
    category: 'merchant',
    defaultValue: '默认商户'
  },

  // 系统配置
  {
    key: 'system.admin_password',
    label: '管理员密码',
    description: '系统管理员登录密码',
    type: 'password',
    required: true,
    category: 'system',
    placeholder: '请输入管理员密码',
    sensitive: true
  },
  {
    key: 'system.jwt_secret',
    label: 'JWT密钥',
    description: '用户认证JWT签名密钥',
    type: 'password',
    required: true,
    category: 'system',
    placeholder: '请输入JWT密钥',
    sensitive: true
  },
  {
    key: 'system.session_timeout',
    label: '会话超时时间',
    description: '用户会话超时时间（小时）',
    type: 'number',
    category: 'system',
    defaultValue: '24'
  },

  // 支付配置
  {
    key: 'payment.order_timeout',
    label: '订单超时时间',
    description: '订单过期时间（分钟）',
    type: 'number',
    category: 'payment',
    defaultValue: '30'
  },
  {
    key: 'payment.auto_match_enabled',
    label: '自动匹配支付',
    description: '是否启用自动匹配支付功能',
    type: 'boolean',
    category: 'payment',
    defaultValue: 'true'
  },
  {
    key: 'payment.callback_retry_times',
    label: '回调重试次数',
    description: '支付回调失败时的重试次数',
    type: 'number',
    category: 'payment',
    defaultValue: '3'
  },
  {
    key: 'payment.callback_timeout',
    label: '回调超时时间',
    description: '支付回调请求超时时间（秒）',
    type: 'number',
    category: 'payment',
    defaultValue: '30'
  },

  // 安全配置
  {
    key: 'security.rate_limit_enabled',
    label: '启用限流',
    description: '是否启用API请求限流',
    type: 'boolean',
    category: 'security',
    defaultValue: 'true'
  },
  {
    key: 'security.max_requests_per_minute',
    label: '每分钟最大请求数',
    description: '单个IP每分钟最大请求数',
    type: 'number',
    category: 'security',
    defaultValue: '100'
  },
  {
    key: 'security.webhook_signature_required',
    label: '要求Webhook签名',
    description: '是否要求Webhook请求包含有效签名',
    type: 'boolean',
    category: 'security',
    defaultValue: 'true'
  },

  // 通知配置
  {
    key: 'notification.email_enabled',
    label: '启用邮件通知',
    description: '是否启用邮件通知功能',
    type: 'boolean',
    category: 'notification',
    defaultValue: 'false'
  },
  {
    key: 'notification.email_smtp_host',
    label: 'SMTP服务器',
    description: '邮件SMTP服务器地址',
    type: 'string',
    category: 'notification',
    placeholder: 'smtp.gmail.com'
  },
  {
    key: 'notification.email_smtp_port',
    label: 'SMTP端口',
    description: 'SMTP服务器端口',
    type: 'number',
    category: 'notification',
    defaultValue: '587'
  },
  {
    key: 'notification.email_user',
    label: '邮箱用户名',
    description: 'SMTP认证用户名',
    type: 'string',
    category: 'notification',
    placeholder: 'your-email@gmail.com'
  },
  {
    key: 'notification.email_password',
    label: '邮箱密码',
    description: 'SMTP认证密码或应用密码',
    type: 'password',
    category: 'notification',
    placeholder: '请输入邮箱密码',
    sensitive: true
  }
];

// 配置分类
export const CONFIG_CATEGORIES = {
  webhook: 'Webhook配置',
  merchant: '商户配置',
  system: '系统配置',
  payment: '支付配置',
  security: '安全配置',
  notification: '通知配置'
};

// 配置管理类
export class SystemConfigManager {
  private static instance: SystemConfigManager;
  private configCache = new Map<string, string>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  static getInstance(): SystemConfigManager {
    if (!SystemConfigManager.instance) {
      SystemConfigManager.instance = new SystemConfigManager();
    }
    return SystemConfigManager.instance;
  }

  // 获取配置值
  async get(key: string, defaultValue?: string): Promise<string | null> {
    // 检查缓存
    if (this.configCache.has(key)) {
      const expiry = this.cacheExpiry.get(key) || 0;
      if (Date.now() < expiry) {
        return this.configCache.get(key) || null;
      }
      // 缓存过期，清理
      this.configCache.delete(key);
      this.cacheExpiry.delete(key);
    }

    // 从数据库获取
    try {
      const value = await getSystemConfig(key);
      
      if (value !== null) {
        // 更新缓存
        this.configCache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
        return value;
      }
      
      // 如果数据库中没有，使用默认值
      if (defaultValue !== undefined) {
        await this.set(key, defaultValue);
        return defaultValue;
      }
      
      return null;
    } catch (error) {
      console.error(`获取配置失败: ${key}`, error);
      return defaultValue || null;
    }
  }

  // 设置配置值
  async set(key: string, value: string, description?: string): Promise<void> {
    try {
      await setSystemConfig(key, value, description);
      
      // 更新缓存
      this.configCache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
    } catch (error) {
      console.error(`设置配置失败: ${key}`, error);
      throw error;
    }
  }

  // 获取布尔值配置
  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const value = await this.get(key, defaultValue.toString());
    return value === 'true';
  }

  // 获取数字配置
  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const value = await this.get(key, defaultValue.toString());
    return value ? parseInt(value, 10) : defaultValue;
  }

  // 获取JSON配置
  async getJSON<T = unknown>(key: string, defaultValue?: T): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return defaultValue || null;
    
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue || null;
    }
  }

  // 批量获取配置
  async getAll(): Promise<Record<string, string>> {
    const configs: Record<string, string> = {};
    
    for (const config of SYSTEM_CONFIGS) {
      const value = await this.get(config.key, config.defaultValue);
      if (value !== null) {
        configs[config.key] = value;
      }
    }
    
    return configs;
  }

  // 初始化默认配置
  async initializeDefaults(): Promise<void> {
    console.log('初始化系统默认配置...');
    
    for (const config of SYSTEM_CONFIGS) {
      if (config.defaultValue !== undefined) {
        const existing = await getSystemConfig(config.key);
        if (existing === null) {
          await this.set(config.key, config.defaultValue, config.description);
          console.log(`设置默认配置: ${config.key} = ${config.defaultValue}`);
        }
      }
    }
  }

  // 清理缓存
  clearCache(): void {
    this.configCache.clear();
    this.cacheExpiry.clear();
  }

  // 获取配置定义
  getConfigDefinition(key: string): ConfigDefinition | undefined {
    return SYSTEM_CONFIGS.find(c => c.key === key);
  }

  // 按分类获取配置
  getConfigsByCategory(category: string): ConfigDefinition[] {
    return SYSTEM_CONFIGS.filter(c => c.category === category);
  }
}

// 导出单例实例
export const systemConfig = SystemConfigManager.getInstance();

// 便捷方法
export const getConfig = (key: string, defaultValue?: string) => systemConfig.get(key, defaultValue);
export const setConfig = (key: string, value: string, description?: string) => systemConfig.set(key, value, description);
export const getBooleanConfig = (key: string, defaultValue?: boolean) => systemConfig.getBoolean(key, defaultValue);
export const getNumberConfig = (key: string, defaultValue?: number) => systemConfig.getNumber(key, defaultValue);
export const getJSONConfig = <T = unknown>(key: string, defaultValue?: T) => systemConfig.getJSON<T>(key, defaultValue);