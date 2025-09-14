#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_H2Drm0jWCZks@ep-fancy-leaf-aduikves-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function migrateData() {
  try {
    console.log('🚀 开始数据迁移...');
    
    const dataDir = path.join(__dirname, '../data');
    
    // 迁移支付记录
    const paymentsFile = path.join(dataDir, 'payments.json');
    if (fs.existsSync(paymentsFile)) {
      const payments = JSON.parse(fs.readFileSync(paymentsFile, 'utf8'));
      console.log(`📊 发现 ${payments.length} 条支付记录`);
      
      for (const payment of payments) {
        try {
          await sql`
            INSERT INTO payments (
              id, amount, uid, payment_method, status, source, customer_type,
              raw_message, match_confidence, callback_status, callback_url, 
              timestamp, created_at, updated_at
            ) VALUES (
              ${payment.id}, ${payment.amount}, ${payment.uid}, ${payment.paymentMethod},
              ${payment.status}, ${payment.source || 'webhook'}, ${payment.customerType || null},
              ${payment.rawMessage || null}, ${payment.matchConfidence || null}, 
              ${payment.callbackStatus || 'pending'}, ${payment.callbackUrl || null},
              ${payment.timestamp ? new Date(payment.timestamp) : new Date()},
              ${payment.timestamp ? new Date(payment.timestamp) : new Date()},
              ${payment.timestamp ? new Date(payment.timestamp) : new Date()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        } catch (error) {
          console.warn(`警告: 跳过支付记录 ${payment.id}:`, error.message);
        }
      }
      console.log('✅ 支付记录迁移完成');
    }
    
    // 迁移演示订单
    const ordersFile = path.join(dataDir, 'demo-orders.json');
    if (fs.existsSync(ordersFile)) {
      const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
      console.log(`📋 发现 ${orders.length} 条演示订单`);
      
      for (const order of orders) {
        try {
          await sql`
            INSERT INTO demo_orders (
              order_id, product_name, amount, payment_method, status, payment_id,
              customer_info, expires_at, created_at, updated_at
            ) VALUES (
              ${order.orderId}, ${order.productName}, ${order.amount}, ${order.paymentMethod},
              ${order.status}, ${order.paymentId || null}, ${JSON.stringify(order.customerInfo || {})},
              ${order.expiresAt ? new Date(order.expiresAt) : new Date(Date.now() + 15 * 60 * 1000)},
              ${order.createdAt ? new Date(order.createdAt) : new Date()},
              ${new Date()}
            )
            ON CONFLICT (order_id) DO NOTHING
          `;
        } catch (error) {
          console.warn(`警告: 跳过订单 ${order.orderId}:`, error.message);
        }
      }
      console.log('✅ 演示订单迁移完成');
    }
    
    // 迁移商户配置
    const merchantsFile = path.join(dataDir, 'merchants.json');
    if (fs.existsSync(merchantsFile)) {
      const merchantData = JSON.parse(fs.readFileSync(merchantsFile, 'utf8'));
      console.log('💼 迁移商户配置');
      
      await sql`
        INSERT INTO merchants (id, callback_url, api_key, name, description, is_active)
        VALUES (
          'default',
          ${merchantData.callbackUrl || 'http://localhost:3001/callback'},
          ${merchantData.apiKey || '34073969'},
          ${merchantData.name || '默认商户'},
          ${merchantData.description || '从JSON文件迁移的商户配置'},
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          callback_url = EXCLUDED.callback_url,
          api_key = EXCLUDED.api_key,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at = now()
      `;
      console.log('✅ 商户配置迁移完成');
    }
    
    // 迁移二维码
    const qrcodesFile = path.join(dataDir, 'qrcodes.json');
    if (fs.existsSync(qrcodesFile)) {
      const qrcodes = JSON.parse(fs.readFileSync(qrcodesFile, 'utf8'));
      console.log(`🔲 发现 ${qrcodes.length} 个二维码`);
      
      for (const qr of qrcodes) {
        try {
          await sql`
            INSERT INTO qr_codes (
              id, name, type, image_url, description, is_active, sort_order, created_at, updated_at
            ) VALUES (
              ${qr.id}, ${qr.name}, ${qr.type}, ${qr.imageUrl},
              ${qr.description || null}, ${qr.isActive !== false}, ${qr.sortOrder || 0},
              ${new Date()}, ${new Date()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        } catch (error) {
          console.warn(`警告: 跳过二维码 ${qr.id}:`, error.message);
        }
      }
      console.log('✅ 二维码迁移完成');
    }
    
    // 迁移未匹配支付
    const unmatchedFile = path.join(dataDir, 'unmatched-payments.json');
    if (fs.existsSync(unmatchedFile)) {
      const unmatched = JSON.parse(fs.readFileSync(unmatchedFile, 'utf8'));
      console.log(`❓ 发现 ${unmatched.length} 条未匹配支付`);
      
      for (const payment of unmatched) {
        try {
          await sql`
            INSERT INTO unmatched_payments (
              id, amount, uid, payment_method, customer_type, raw_message,
              source, is_processed, processed_order_id, timestamp, created_at
            ) VALUES (
              ${payment.paymentId || 'UMP' + Date.now() + Math.random().toString(36).substring(2, 6)},
              ${payment.amount}, ${payment.uid || 'unknown'}, ${payment.paymentMethod},
              ${payment.customerType || null}, ${payment.rawMessage || null},
              'webhook', ${payment.status === 'matched' || payment.status === 'confirmed'}, 
              ${payment.processedOrderId || null},
              ${payment.receivedAt ? new Date(payment.receivedAt) : new Date()},
              ${payment.receivedAt ? new Date(payment.receivedAt) : new Date()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
        } catch (error) {
          console.warn(`警告: 跳过未匹配支付:`, error.message);
        }
      }
      console.log('✅ 未匹配支付迁移完成');
    }
    
    console.log('\n🎉 数据迁移完成！');
    console.log('\n📊 迁移统计:');
    
    // 显示迁移后的统计
    const [paymentCount] = await sql`SELECT count(*) as count FROM payments`;
    const [orderCount] = await sql`SELECT count(*) as count FROM demo_orders`;
    const [qrCount] = await sql`SELECT count(*) as count FROM qr_codes`;
    const [unmatchedCount] = await sql`SELECT count(*) as count FROM unmatched_payments`;
    
    console.log(`  - 支付记录: ${paymentCount.count} 条`);
    console.log(`  - 演示订单: ${orderCount.count} 条`);
    console.log(`  - 二维码: ${qrCount.count} 个`);
    console.log(`  - 未匹配支付: ${unmatchedCount.count} 条`);
    
    console.log('\n💡 提示: JSON文件仍保留作为备份，您可以手动删除它们');
    
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    process.exit(1);
  }
}

migrateData();