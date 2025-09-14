import { NextRequest, NextResponse } from 'next/server';
import { systemConfig } from '@/lib/system-config';
import { isAuthenticated } from '@/lib/simple-auth';

export async function POST(request: NextRequest) {
  try {
    // 验证身份
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 从环境变量迁移配置
    const envMigrations = [
      {
        key: 'webhook.api_key',
        env: 'WEBHOOK_API_KEY',
        description: 'Webhook接口认证密钥'
      },
      {
        key: 'merchant.callback_url',
        env: 'MERCHANT_CALLBACK_URL',
        description: '商户回调URL'
      },
      {
        key: 'merchant.api_key',
        env: 'MERCHANT_API_KEY',
        description: '商户API密钥'
      }
    ];

    const migrated = [];
    const skipped = [];

    for (const { key, env, description } of envMigrations) {
      const envValue = process.env[env];
      if (envValue) {
        const existingValue = await systemConfig.get(key);
        if (!existingValue) {
          await systemConfig.set(key, envValue, description);
          migrated.push(`${key} = ${envValue}`);
        } else {
          skipped.push(`${key} (已存在)`);
        }
      }
    }

    // 设置默认系统配置
    const defaultConfigs = [
      {
        key: 'system.admin_password',
        value: 'admin123',
        description: '系统管理员密码'
      },
      {
        key: 'system.jwt_secret',
        value: 'jwt-secret-' + Math.random().toString(36).substring(2, 15),
        description: 'JWT签名密钥'
      },
      {
        key: 'payment.order_timeout',
        value: '30',
        description: '订单超时时间（分钟）'
      },
      {
        key: 'payment.auto_match_enabled',
        value: 'true',
        description: '是否启用自动匹配支付功能'
      },
      {
        key: 'security.rate_limit_enabled',
        value: 'true',
        description: '是否启用API请求限流'
      },
      {
        key: 'security.max_requests_per_minute',
        value: '100',
        description: '单个IP每分钟最大请求数'
      },
      {
        key: 'notification.email_enabled',
        value: 'false',
        description: '是否启用邮件通知功能'
      }
    ];

    const defaults = [];
    for (const { key, value, description } of defaultConfigs) {
      const existing = await systemConfig.get(key);
      if (!existing) {
        await systemConfig.set(key, value, description);
        defaults.push(`${key} = ${value}`);
      } else {
        skipped.push(`${key} (已存在)`);
      }
    }

    // 调用通用初始化方法
    await systemConfig.initializeDefaults();

    return NextResponse.json({
      success: true,
      message: '系统配置初始化完成',
      migrated,
      defaults,
      skipped,
      warnings: [
        '请在系统设置中修改默认密码',
        '生产环境中请设置强密码和安全的JWT密钥'
      ]
    });

  } catch (error) {
    console.error('初始化系统配置失败:', error);
    return NextResponse.json(
      { error: '初始化失败: ' + String(error) },
      { status: 500 }
    );
  }
}