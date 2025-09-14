#!/usr/bin/env tsx

/**
 * 系统配置初始化脚本
 * 将环境变量迁移到数据库，并设置默认值
 */

// 加载环境变量
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env.local:', result.error);
} else {
  console.log('Environment loaded successfully');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
}

import { systemConfig } from '../lib/system-config';

async function initializeSystemConfig() {
  console.log('🚀 开始初始化系统配置...');

  try {
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

    console.log('📦 迁移环境变量到数据库...');
    for (const { key, env, description } of envMigrations) {
      const envValue = process.env[env];
      if (envValue) {
        const existingValue = await systemConfig.get(key);
        if (!existingValue) {
          await systemConfig.set(key, envValue, description);
          console.log(`✅ 迁移 ${key} = ${envValue}`);
        } else {
          console.log(`⏭️  ${key} 已存在，跳过迁移`);
        }
      }
    }

    // 设置默认系统配置
    console.log('⚙️  初始化默认配置...');
    const defaultConfigs = [
      {
        key: 'system.admin_password',
        value: 'admin123', // 生产环境中应该修改
        description: '系统管理员密码'
      },
      {
        key: 'system.jwt_secret',
        value: 'your-jwt-secret-' + Math.random().toString(36).substring(2, 15),
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

    for (const { key, value, description } of defaultConfigs) {
      const existing = await systemConfig.get(key);
      if (!existing) {
        await systemConfig.set(key, value, description);
        console.log(`✅ 设置默认配置 ${key} = ${value}`);
      } else {
        console.log(`⏭️  ${key} 已存在，跳过设置`);
      }
    }

    // 调用初始化默认配置方法
    await systemConfig.initializeDefaults();

    console.log('🎉 系统配置初始化完成！');

    // 显示重要提示
    console.log('\n⚠️  重要提示:');
    console.log('1. 请在系统设置中修改默认密码');
    console.log('2. 生产环境中请设置强密码和安全的JWT密钥');
    console.log('3. 配置完成后可以删除 .env.local 中的相关配置项');
    console.log('4. 访问系统管理界面的"系统设置"标签页进行详细配置');

    // 显示当前所有配置
    console.log('\n📋 当前系统配置:');
    const allConfigs = await systemConfig.getAll();
    Object.entries(allConfigs).forEach(([key, value]) => {
      if (key.includes('password') || key.includes('secret') || key.includes('key')) {
        console.log(`${key}: ***已设置***`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });

  } catch (error) {
    console.error('❌ 初始化系统配置失败:', error);
    process.exit(1);
  }
}

// 执行初始化
initializeSystemConfig();