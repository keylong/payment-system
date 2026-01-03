import { pgTable, text, real, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
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
  merchantId: text('merchant_id').default('default'), // 商户ID，默认为default兼容旧数据
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('payments_callback_status_idx').on(table.callbackStatus),
  index('payments_merchant_id_idx').on(table.merchantId),
  index('payments_timestamp_idx').on(table.timestamp),
  index('payments_status_callback_idx').on(table.status, table.callbackStatus),
]);

// 演示订单表
export const demoOrders = pgTable('demo_orders', {
  orderId: text('order_id').primaryKey(),
  productName: text('product_name').notNull(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'alipay' | 'wechat'
  status: text('status').notNull().default('pending'), // 'pending' | 'success' | 'failed' | 'expired'
  paymentId: text('payment_id'),
  merchantId: text('merchant_id').default('default'), // 商户ID，默认为default兼容旧数据
  customerInfo: jsonb('customer_info').$type<{
    name?: string;
    email?: string;
    phone?: string;
  }>(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('demo_orders_status_idx').on(table.status),
  index('demo_orders_merchant_id_idx').on(table.merchantId),
  index('demo_orders_payment_id_idx').on(table.paymentId),
  index('demo_orders_expires_at_idx').on(table.expiresAt),
]);

// 商户配置表
export const merchants = pgTable('merchants', {
  id: text('id').primaryKey().$defaultFn(() => 'MCH' + Date.now() + Math.random().toString(36).substring(2, 6)),
  code: text('code').unique(), // 商户代码，用于API调用时识别商户
  callbackUrl: text('callback_url'),
  apiKey: text('api_key'),
  name: text('name').default('默认商户'),
  description: text('description'),
  webhookSecret: text('webhook_secret'), // 商户webhook签名密钥
  allowedIps: text('allowed_ips'), // 允许的IP白名单，逗号分隔
  callbackRetryTimes: integer('callback_retry_times').default(3), // 回调重试次数
  callbackTimeout: integer('callback_timeout').default(30), // 回调超时时间（秒）
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('merchants_is_active_idx').on(table.isActive),
]);

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
}, (table) => [
  index('qr_codes_type_active_idx').on(table.type, table.isActive),
]);

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
}, (table) => [
  index('unmatched_payments_is_processed_idx').on(table.isProcessed),
  index('unmatched_payments_amount_method_idx').on(table.amount, table.paymentMethod),
]);

// 待匹配订单表
export const pendingOrders = pgTable('pending_orders', {
  orderId: text('order_id').primaryKey(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'alipay' | 'wechat'
  status: text('status').notNull().default('pending'), // 'pending' | 'matched' | 'expired'
  customAmount: real('custom_amount'),
  merchantId: text('merchant_id').default('default'), // 商户ID，默认为default兼容旧数据
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('pending_orders_status_idx').on(table.status),
  index('pending_orders_expires_at_idx').on(table.expiresAt),
  index('pending_orders_amount_method_idx').on(table.amount, table.paymentMethod),
]);

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