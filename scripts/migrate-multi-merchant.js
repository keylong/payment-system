/**
 * 多商户支持迁移脚本
 *
 * 此脚本将：
 * 1. 为 merchants 表添加新字段 (code, webhookSecret, allowedIps, callbackRetryTimes, callbackTimeout)
 * 2. 为 payments 表添加 merchantId 字段
 * 3. 为 demo_orders 表添加 merchantId 字段
 * 4. 为 pending_orders 表添加 merchantId 字段
 * 5. 确保默认商户存在
 *
 * 运行方式: node scripts/migrate-multi-merchant.js
 */

require('dotenv').config();

const { neon } = require('@neondatabase/serverless');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('🚀 开始执行多商户支持迁移...\n');

  try {
    // 1. 为 merchants 表添加新字段
    console.log('1️⃣ 更新 merchants 表结构...');

    // 添加 code 字段
    await sql`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS code TEXT UNIQUE
    `;
    console.log('   ✅ 添加 code 字段');

    // 添加 webhook_secret 字段
    await sql`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS webhook_secret TEXT
    `;
    console.log('   ✅ 添加 webhook_secret 字段');

    // 添加 allowed_ips 字段
    await sql`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS allowed_ips TEXT
    `;
    console.log('   ✅ 添加 allowed_ips 字段');

    // 添加 callback_retry_times 字段
    await sql`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS callback_retry_times INTEGER DEFAULT 3
    `;
    console.log('   ✅ 添加 callback_retry_times 字段');

    // 添加 callback_timeout 字段
    await sql`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS callback_timeout INTEGER DEFAULT 30
    `;
    console.log('   ✅ 添加 callback_timeout 字段');

    // 2. 为 payments 表添加 merchantId 字段
    console.log('\n2️⃣ 更新 payments 表结构...');
    await sql`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS merchant_id TEXT DEFAULT 'default'
    `;
    console.log('   ✅ 添加 merchant_id 字段');

    // 3. 为 demo_orders 表添加 merchantId 字段
    console.log('\n3️⃣ 更新 demo_orders 表结构...');
    await sql`
      ALTER TABLE demo_orders
      ADD COLUMN IF NOT EXISTS merchant_id TEXT DEFAULT 'default'
    `;
    console.log('   ✅ 添加 merchant_id 字段');

    // 4. 为 pending_orders 表添加 merchantId 字段
    console.log('\n4️⃣ 更新 pending_orders 表结构...');
    await sql`
      ALTER TABLE pending_orders
      ADD COLUMN IF NOT EXISTS merchant_id TEXT DEFAULT 'default'
    `;
    console.log('   ✅ 添加 merchant_id 字段');

    // 5. 确保默认商户存在
    console.log('\n5️⃣ 确保默认商户存在...');

    // 检查默认商户是否存在
    const existingDefault = await sql`
      SELECT id FROM merchants WHERE id = 'default'
    `;

    if (existingDefault.length === 0) {
      // 创建默认商户
      await sql`
        INSERT INTO merchants (id, code, name, description, is_active, created_at, updated_at)
        VALUES ('default', 'default', '默认商户', '系统默认商户，用于向下兼容', true, NOW(), NOW())
      `;
      console.log('   ✅ 创建默认商户');
    } else {
      // 更新默认商户的code字段
      await sql`
        UPDATE merchants
        SET code = 'default', updated_at = NOW()
        WHERE id = 'default' AND (code IS NULL OR code = '')
      `;
      console.log('   ✅ 默认商户已存在，已更新');
    }

    // 6. 将现有数据的 merchantId 设为 default（如果为空）
    console.log('\n6️⃣ 更新现有数据的商户关联...');

    await sql`
      UPDATE payments SET merchant_id = 'default' WHERE merchant_id IS NULL
    `;
    console.log('   ✅ 更新 payments 表中的商户关联');

    await sql`
      UPDATE demo_orders SET merchant_id = 'default' WHERE merchant_id IS NULL
    `;
    console.log('   ✅ 更新 demo_orders 表中的商户关联');

    await sql`
      UPDATE pending_orders SET merchant_id = 'default' WHERE merchant_id IS NULL
    `;
    console.log('   ✅ 更新 pending_orders 表中的商户关联');

    console.log('\n✅ 多商户支持迁移完成！\n');

    // 显示迁移后的商户列表
    const merchants = await sql`SELECT id, code, name, is_active FROM merchants`;
    console.log('当前商户列表:');
    console.table(merchants);

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

migrate();
