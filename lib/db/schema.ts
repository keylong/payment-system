import { pgTable, text, real, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// 支付记录表
export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => 'PAY' + Date.now() + Math.random().toString(36).substring(2, 8)),
  amount: real('amount').notNull(),
  uid: text('uid').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'alipay' | 'wechat'
  status: text('status').notNull().default('success'), // 'success' | 'failed'
  source: text('source').notNull().default('webhook'), // 'webhook' | 'manual'
  customerType: text('customer_type'),
  rawMessage: text('raw_message'),
  matchConfidence: real('match_confidence'),
  callbackStatus: text('callback_status').default('pending'), // 'pending' | 'sent' | 'failed'
  callbackUrl: text('callback_url'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 演示订单表
export const demoOrders = pgTable('demo_orders', {
  orderId: text('order_id').primaryKey(),
  productName: text('product_name').notNull(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'alipay' | 'wechat'
  status: text('status').notNull().default('pending'), // 'pending' | 'success' | 'failed' | 'expired'
  paymentId: text('payment_id'),
  customerInfo: jsonb('customer_info').$type<{
    name?: string;
    email?: string;
    phone?: string;
  }>(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 商户配置表
export const merchants = pgTable('merchants', {
  id: text('id').primaryKey().default('default'),
  callbackUrl: text('callback_url'),
  apiKey: text('api_key'),
  name: text('name').default('默认商户'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 二维码管理表
export const qrCodes = pgTable('qr_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'alipay' | 'wechat'
  imageUrl: text('image_url').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 未匹配支付记录表
export const unmatchedPayments = pgTable('unmatched_payments', {
  id: text('id').primaryKey().$defaultFn(() => 'UMP' + Date.now() + Math.random().toString(36).substring(2, 6)),
  amount: real('amount').notNull(),
  uid: text('uid').notNull(),
  paymentMethod: text('payment_method').notNull(),
  customerType: text('customer_type'),
  rawMessage: text('raw_message'),
  source: text('source').notNull().default('webhook'),
  isProcessed: boolean('is_processed').default(false),
  processedOrderId: text('processed_order_id'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 待匹配订单表
export const pendingOrders = pgTable('pending_orders', {
  orderId: text('order_id').primaryKey(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'alipay' | 'wechat'
  status: text('status').notNull().default('pending'), // 'pending' | 'matched' | 'expired'
  customAmount: real('custom_amount'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 系统配置表
export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value'),
  description: text('description'),
  type: text('type').default('string'), // 'string' | 'number' | 'boolean' | 'json'
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 类型定义
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type DemoOrder = typeof demoOrders.$inferSelect;
export type NewDemoOrder = typeof demoOrders.$inferInsert;

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;

export type QRCode = typeof qrCodes.$inferSelect;
export type NewQRCode = typeof qrCodes.$inferInsert;

export type UnmatchedPayment = typeof unmatchedPayments.$inferSelect;
export type NewUnmatchedPayment = typeof unmatchedPayments.$inferInsert;

export type PendingOrder = typeof pendingOrders.$inferSelect;
export type NewPendingOrder = typeof pendingOrders.$inferInsert;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;