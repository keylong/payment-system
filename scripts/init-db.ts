#!/usr/bin/env tsx

import { testDatabaseConnection, db } from '../lib/db/connection';
import { 
  merchants, 
  systemConfig 
} from '../lib/db/schema';

async function initDatabase() {
  try {
    console.log('🚀 开始初始化数据库...');
    
    // 测试连接
    await testDatabaseConnection();
    
    console.log('📊 数据库表已准备就绪');
    
    // 插入默认商户配置
    console.log('💼 插入默认商户配置...');
    await db.insert(merchants).values({
      id: 'default',
      callbackUrl: 'http://localhost:3001/callback',
      apiKey: '34073969',
      name: '默认商户',
      description: '系统默认商户配置',
      isActive: true,
    }).onConflictDoNothing();
    
    // 插入系统配置
    console.log('⚙️ 插入系统配置...');
    const configs = [
      {
        key: 'webhook_api_key',
        value: '34073969',
        description: 'Webhook API密钥',
        type: 'string'
      },
      {
        key: 'order_expiry_minutes',
        value: '15',
        description: '订单过期时间（分钟）',
        type: 'number'
      },
      {
        key: 'auto_match_enabled',
        value: 'true',
        description: '启用智能订单匹配',
        type: 'boolean'
      }
    ];
    
    for (const config of configs) {
      await db.insert(systemConfig).values(config).onConflictDoNothing();
    }
    
    console.log('✅ 数据库初始化完成!');
    console.log('\n📋 数据库表:');
    console.log('  - payments (支付记录)');
    console.log('  - demo_orders (演示订单)');
    console.log('  - merchants (商户配置)');
    console.log('  - qr_codes (二维码管理)');
    console.log('  - unmatched_payments (未匹配支付)');
    console.log('  - system_config (系统配置)');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  initDatabase();
}