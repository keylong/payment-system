#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_H2Drm0jWCZks@ep-fancy-leaf-aduikves-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

const createTables = async () => {
  try {
    console.log('🚀 开始创建数据库表...');
    
    // 测试连接
    const result = await sql`SELECT version()`;
    console.log('✅ 数据库连接成功:', result[0]?.version?.substring(0, 50) + '...');
    
    // 创建支付记录表
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id text PRIMARY KEY,
        amount real NOT NULL,
        uid text NOT NULL,
        payment_method text NOT NULL,
        status text DEFAULT 'success' NOT NULL,
        source text DEFAULT 'webhook' NOT NULL,
        customer_type text,
        raw_message text,
        match_confidence real,
        callback_status text DEFAULT 'pending',
        callback_url text,
        timestamp timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 payments 表');
    
    // 创建演示订单表
    await sql`
      CREATE TABLE IF NOT EXISTS demo_orders (
        order_id text PRIMARY KEY,
        product_name text NOT NULL,
        amount real NOT NULL,
        payment_method text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        payment_id text,
        customer_info jsonb,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 demo_orders 表');
    
    // 创建商户配置表
    await sql`
      CREATE TABLE IF NOT EXISTS merchants (
        id text PRIMARY KEY DEFAULT 'default',
        callback_url text,
        api_key text,
        name text DEFAULT '默认商户',
        description text,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 merchants 表');
    
    // 创建二维码管理表
    await sql`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id text PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        image_url text NOT NULL,
        description text,
        is_active boolean DEFAULT true,
        sort_order integer DEFAULT 0,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 qr_codes 表');
    
    // 创建未匹配支付记录表
    await sql`
      CREATE TABLE IF NOT EXISTS unmatched_payments (
        id text PRIMARY KEY,
        amount real NOT NULL,
        uid text NOT NULL,
        payment_method text NOT NULL,
        customer_type text,
        raw_message text,
        source text DEFAULT 'webhook' NOT NULL,
        is_processed boolean DEFAULT false,
        processed_order_id text,
        timestamp timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 unmatched_payments 表');
    
    // 创建待匹配订单表
    await sql`
      CREATE TABLE IF NOT EXISTS pending_orders (
        order_id text PRIMARY KEY,
        amount real NOT NULL,
        payment_method text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        custom_amount real,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 pending_orders 表');
    
    // 创建系统配置表
    await sql`
      CREATE TABLE IF NOT EXISTS system_config (
        key text PRIMARY KEY,
        value text,
        description text,
        type text DEFAULT 'string',
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ 创建 system_config 表');
    
    // 插入默认商户配置
    await sql`
      INSERT INTO merchants (id, callback_url, api_key, name, description, is_active)
      VALUES ('default', 'http://localhost:3001/callback', '34073969', '默认商户', '系统默认商户配置', true)
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ 插入默认商户配置');
    
    // 插入系统配置
    const configs = [
      ['webhook_api_key', '34073969', 'Webhook API密钥', 'string'],
      ['order_expiry_minutes', '15', '订单过期时间（分钟）', 'number'],
      ['auto_match_enabled', 'true', '启用智能订单匹配', 'boolean']
    ];
    
    for (const [key, value, description, type] of configs) {
      await sql`
        INSERT INTO system_config (key, value, description, type)
        VALUES (${key}, ${value}, ${description}, ${type})
        ON CONFLICT (key) DO NOTHING
      `;
    }
    console.log('✅ 插入系统配置');
    
    console.log('\n🎉 数据库表创建完成！');
    console.log('\n📋 已创建的表：');
    console.log('  - payments (支付记录)');
    console.log('  - demo_orders (演示订单)');
    console.log('  - merchants (商户配置)');
    console.log('  - qr_codes (二维码管理)');
    console.log('  - unmatched_payments (未匹配支付)');
    console.log('  - pending_orders (待匹配订单)');
    console.log('  - system_config (系统配置)');
    
  } catch (error) {
    console.error('❌ 创建数据库表失败:', error);
    process.exit(1);
  }
};

createTables();