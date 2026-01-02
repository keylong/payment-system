import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from './db/connection';
import { 
  payments, 
  demoOrders, 
  merchants, 
  qrCodes, 
  unmatchedPayments, 
  pendingOrders,
  systemConfig,
  type Payment,
  type NewPayment,
  type DemoOrder,
  type NewDemoOrder,
  type Merchant,
  type QRCode,
  type NewQRCode,
  type UnmatchedPayment,
  type NewUnmatchedPayment,
  type PendingOrder,
  type NewPendingOrder
} from './db/schema';

// 支付记录操作
export async function savePaymentRecord(data: Omit<NewPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
  const id = 'PAY' + Date.now() + Math.random().toString(36).substring(2, 8);
  
  const [payment] = await db.insert(payments).values({
    ...data,
    id,
  }).returning();
  
  return payment;
}

export async function getPaymentRecords(): Promise<Payment[]> {
  return await db.select().from(payments).orderBy(desc(payments.createdAt));
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, id));
  return payment || null;
}

export async function updatePaymentRecord(id: string, data: Partial<Payment>): Promise<void> {
  await db.update(payments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(payments.id, id));
}

// 演示订单操作
export async function saveDemoOrder(data: NewDemoOrder): Promise<DemoOrder> {
  const [order] = await db.insert(demoOrders).values(data).returning();
  return order;
}

export async function getDemoOrders(): Promise<DemoOrder[]> {
  return await db.select().from(demoOrders).orderBy(desc(demoOrders.createdAt));
}

// 获取订单及其关联的支付信息（包含回调状态）
export async function getDemoOrdersWithPaymentInfo(): Promise<(DemoOrder & { callbackStatus?: string, callbackUrl?: string })[]> {
  const ordersResult = await db
    .select({
      orderId: demoOrders.orderId,
      productName: demoOrders.productName,
      amount: demoOrders.amount,
      paymentMethod: demoOrders.paymentMethod,
      status: demoOrders.status,
      paymentId: demoOrders.paymentId,
      customerInfo: demoOrders.customerInfo,
      expiresAt: demoOrders.expiresAt,
      createdAt: demoOrders.createdAt,
      updatedAt: demoOrders.updatedAt,
      callbackStatus: payments.callbackStatus,
      callbackUrl: payments.callbackUrl,
    })
    .from(demoOrders)
    .leftJoin(payments, eq(demoOrders.paymentId, payments.id))
    .orderBy(desc(demoOrders.createdAt));

  return ordersResult.map(order => ({
    ...order,
    callbackStatus: order.callbackStatus || undefined,
    callbackUrl: order.callbackUrl || undefined
  }));
}

export async function getDemoOrderById(orderId: string): Promise<DemoOrder | null> {
  const [order] = await db.select().from(demoOrders).where(eq(demoOrders.orderId, orderId));
  return order || null;
}

// 通过支付记录ID查找对应的订单（若已关联）
export async function getDemoOrderByPaymentId(paymentId: string): Promise<DemoOrder | null> {
  const [order] = await db
    .select()
    .from(demoOrders)
    .where(eq(demoOrders.paymentId, paymentId));
  return order || null;
}

export async function updateDemoOrder(orderId: string, data: Partial<DemoOrder>): Promise<void> {
  const updateData = { ...data, updatedAt: new Date() } as Partial<DemoOrder> & { updatedAt: Date };
  await db.update(demoOrders)
    .set(updateData)
    .where(eq(demoOrders.orderId, orderId));
}

export async function getExpiredOrders(): Promise<DemoOrder[]> {
  return await db.select()
    .from(demoOrders)
    .where(
      and(
        eq(demoOrders.status, 'pending'),
        lte(demoOrders.expiresAt, new Date())
      )
    );
}

export async function markExpiredOrders(): Promise<void> {
  await db.update(demoOrders)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(demoOrders.status, 'pending'),
        lte(demoOrders.expiresAt, new Date())
      )
    );
}

// 商户配置操作
export async function getMerchantConfig(): Promise<Merchant | null> {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, 'default'));
  return merchant || null;
}

export async function updateMerchantConfig(data: Partial<Merchant>): Promise<void> {
  await db.update(merchants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(merchants.id, 'default'));
}

// 多商户管理操作
export async function getAllMerchants(): Promise<Merchant[]> {
  return await db.select().from(merchants).orderBy(desc(merchants.createdAt));
}

export async function getActiveMerchants(): Promise<Merchant[]> {
  return await db.select().from(merchants).where(eq(merchants.isActive, true)).orderBy(merchants.name);
}

export async function getMerchantById(id: string): Promise<Merchant | null> {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
  return merchant || null;
}

export async function getMerchantByCode(code: string): Promise<Merchant | null> {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.code, code));
  return merchant || null;
}

export async function createMerchant(data: {
  code: string;
  name: string;
  callbackUrl?: string;
  apiKey?: string;
  description?: string;
  webhookSecret?: string;
  allowedIps?: string;
  callbackRetryTimes?: number;
  callbackTimeout?: number;
}): Promise<Merchant> {
  const id = 'MCH' + Date.now() + Math.random().toString(36).substring(2, 6);
  const [merchant] = await db.insert(merchants).values({
    id,
    code: data.code,
    name: data.name,
    callbackUrl: data.callbackUrl,
    apiKey: data.apiKey,
    description: data.description,
    webhookSecret: data.webhookSecret,
    allowedIps: data.allowedIps,
    callbackRetryTimes: data.callbackRetryTimes ?? 3,
    callbackTimeout: data.callbackTimeout ?? 30,
    isActive: true,
  }).returning();
  return merchant;
}

export async function updateMerchant(id: string, data: Partial<Merchant>): Promise<void> {
  await db.update(merchants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(merchants.id, id));
}

export async function deleteMerchant(id: string): Promise<void> {
  // 不允许删除默认商户
  if (id === 'default') {
    throw new Error('不能删除默认商户');
  }
  await db.delete(merchants).where(eq(merchants.id, id));
}

// 确保默认商户存在
export async function ensureDefaultMerchant(): Promise<Merchant> {
  let [merchant] = await db.select().from(merchants).where(eq(merchants.id, 'default'));

  if (!merchant) {
    [merchant] = await db.insert(merchants).values({
      id: 'default',
      code: 'default',
      name: '默认商户',
      description: '系统默认商户，用于向下兼容',
      isActive: true,
    }).returning();
  }

  return merchant;
}

// 二维码操作
export async function getQRCodes(): Promise<QRCode[]> {
  return await db.select().from(qrCodes).orderBy(qrCodes.sortOrder, qrCodes.createdAt);
}

export async function getActiveQRCodes(): Promise<QRCode[]> {
  return await db.select()
    .from(qrCodes)
    .where(eq(qrCodes.isActive, true))
    .orderBy(qrCodes.sortOrder, qrCodes.createdAt);
}

export async function saveQRCode(data: NewQRCode): Promise<QRCode> {
  const [qrCode] = await db.insert(qrCodes).values(data).returning();
  return qrCode;
}

export async function updateQRCode(id: string, data: Partial<QRCode>): Promise<void> {
  await db.update(qrCodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(qrCodes.id, id));
}

export async function deleteQRCode(id: string): Promise<void> {
  await db.delete(qrCodes).where(eq(qrCodes.id, id));
}

// 未匹配支付操作
export async function saveUnmatchedPayment(data: Omit<NewUnmatchedPayment, 'id' | 'createdAt'>): Promise<UnmatchedPayment> {
  const id = 'UMP' + Date.now() + Math.random().toString(36).substring(2, 6);
  
  const [payment] = await db.insert(unmatchedPayments).values({
    ...data,
    id,
  }).returning();
  
  return payment;
}

export async function getUnmatchedPayments(): Promise<UnmatchedPayment[]> {
  return await db.select()
    .from(unmatchedPayments)
    .where(eq(unmatchedPayments.isProcessed, false))
    .orderBy(desc(unmatchedPayments.createdAt));
}

export async function confirmPaymentMatch(unmatchedId: string, orderId: string): Promise<void> {
  await db.update(unmatchedPayments)
    .set({ 
      isProcessed: true, 
      processedOrderId: orderId 
    })
    .where(eq(unmatchedPayments.id, unmatchedId));
}

// 统计操作
export async function getPaymentStatistics() {
  // 获取上海时区的今日开始和结束时间
  const now = new Date();
  const shanghaiOffset = 8 * 60; // 上海时区UTC+8
  const localOffset = now.getTimezoneOffset();
  const shanghaiTime = new Date(now.getTime() + (shanghaiOffset + localOffset) * 60000);
  
  const todayStart = new Date(shanghaiTime);
  todayStart.setHours(0, 0, 0, 0);
  // 转回UTC时间用于数据库查询
  const todayStartUTC = new Date(todayStart.getTime() - shanghaiOffset * 60000);
  
  const todayEnd = new Date(shanghaiTime);
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndUTC = new Date(todayEnd.getTime() - shanghaiOffset * 60000);

  // 今日支付统计 - 只统计成功的支付
  const [todayPaymentStats] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<number>`COALESCE(sum(amount), 0)::real`
  }).from(payments).where(
    and(
      eq(payments.status, 'success'),
      gte(payments.createdAt, todayStartUTC),
      lte(payments.createdAt, todayEndUTC)
    )
  );

  // 总支付统计 - 只统计成功的支付
  const [totalPaymentStats] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<number>`COALESCE(sum(amount), 0)::real`
  }).from(payments).where(eq(payments.status, 'success'));

  // 今日订单统计
  const [todayOrderStats] = await db.select({
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    success: sql<number>`count(*) filter (where status = 'success')::int`,
    expired: sql<number>`count(*) filter (where status = 'expired')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    total: sql<number>`count(*)::int`
  }).from(demoOrders).where(
    and(
      gte(demoOrders.createdAt, todayStartUTC),
      lte(demoOrders.createdAt, todayEndUTC)
    )
  );

  // 总订单统计
  const [totalOrderStats] = await db.select({
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    success: sql<number>`count(*) filter (where status = 'success')::int`,
    expired: sql<number>`count(*) filter (where status = 'expired')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    total: sql<number>`count(*)::int`
  }).from(demoOrders);

  // 待匹配支付统计
  const [unmatchedStats] = await db.select({
    count: sql<number>`count(*)::int`
  }).from(unmatchedPayments).where(eq(unmatchedPayments.isProcessed, false));

  return {
    // 今日统计
    todayPayments: todayPaymentStats.count || 0,
    todayAmount: todayPaymentStats.total || 0,
    todayOrders: todayOrderStats.total || 0,
    
    // 总统计
    totalPayments: totalPaymentStats.count || 0,
    totalAmount: totalPaymentStats.total || 0,
    totalOrders: totalOrderStats.total || 0,
    
    // 订单状态统计
    pendingOrders: totalOrderStats.pending || 0,
    successOrders: totalOrderStats.success || 0,
    expiredOrders: totalOrderStats.expired || 0,
    failedOrders: totalOrderStats.failed || 0,
    
    // 待匹配支付
    unmatchedPayments: unmatchedStats.count || 0,
    
    // 成功率计算（基于订单）
    successRate: totalOrderStats.total > 0 
      ? ((totalOrderStats.success / totalOrderStats.total) * 100).toFixed(1) 
      : '0.0'
  };
}

// 系统配置操作
export async function getSystemConfig(key: string): Promise<string | null> {
  const [config] = await db.select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key));
  
  return config?.value || null;
}

export async function setSystemConfig(key: string, value: string, description?: string): Promise<void> {
  await db.insert(systemConfig)
    .values({ key, value, description })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value, updatedAt: new Date() }
    });
}

// 清理过期数据
export async function cleanupOldData(daysToKeep: number = 30): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  // 清理旧的支付记录
  await db.delete(payments).where(lte(payments.createdAt, cutoffDate));
  
  // 清理旧的过期订单
  await db.delete(demoOrders).where(
    and(
      eq(demoOrders.status, 'expired'),
      lte(demoOrders.createdAt, cutoffDate)
    )
  );
  
  // 清理已处理的未匹配支付
  await db.delete(unmatchedPayments).where(
    and(
      eq(unmatchedPayments.isProcessed, true),
      lte(unmatchedPayments.createdAt, cutoffDate)
    )
  );
  
  // 清理过期的待匹配订单
  await db.delete(pendingOrders).where(lte(pendingOrders.expiresAt, cutoffDate));
}

// 待匹配订单操作
export async function savePendingOrder(data: NewPendingOrder): Promise<PendingOrder> {
  const [order] = await db.insert(pendingOrders).values(data).returning();
  return order;
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  return await db.select().from(pendingOrders).orderBy(desc(pendingOrders.createdAt));
}

export async function getPendingOrderById(orderId: string): Promise<PendingOrder | null> {
  const [order] = await db.select().from(pendingOrders).where(eq(pendingOrders.orderId, orderId));
  return order || null;
}

export async function updatePendingOrder(orderId: string, data: Partial<PendingOrder>): Promise<void> {
  await db.update(pendingOrders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pendingOrders.orderId, orderId));
}

export async function getActivePendingOrders(): Promise<PendingOrder[]> {
  const now = new Date();
  return await db.select()
    .from(pendingOrders)
    .where(
      and(
        eq(pendingOrders.status, 'pending'),
        gte(pendingOrders.expiresAt, now)
      )
    )
    .orderBy(desc(pendingOrders.createdAt));
}

export async function cleanupExpiredPendingOrders(): Promise<void> {
  const now = new Date();
  await db.update(pendingOrders)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(pendingOrders.status, 'pending'),
        lte(pendingOrders.expiresAt, now)
      )
    );
}

// 扩展未匹配支付操作，增加状态和可能的订单ID
export interface UnmatchedPaymentWithPossibleOrders extends UnmatchedPayment {
  possibleOrderIds?: string[];
  status?: 'unmatched' | 'matched' | 'confirmed' | 'ignored';
}

export async function saveUnmatchedPaymentWithStatus(data: {
  paymentId: string;
  amount: number;
  paymentMethod: string;
  customerType?: string;
  rawMessage?: string;
  source: string;
  possibleOrderIds?: string[];
  status?: 'unmatched' | 'matched' | 'confirmed' | 'ignored';
}): Promise<UnmatchedPayment> {
  // 创建 rawMessage，包含可能的订单ID信息
  const enrichedRawMessage = data.rawMessage || '';
  const possibleOrdersText = data.possibleOrderIds?.length 
    ? `\nPossibleOrders: ${data.possibleOrderIds.join(',')}\nStatus: ${data.status || 'unmatched'}`
    : `\nStatus: ${data.status || 'unmatched'}`;
  
  const [payment] = await db.insert(unmatchedPayments).values({
    id: data.paymentId,
    amount: data.amount,
    uid: data.possibleOrderIds?.[0] || 'unknown',
    paymentMethod: data.paymentMethod,
    customerType: data.customerType,
    rawMessage: enrichedRawMessage + possibleOrdersText,
    source: data.source,
    isProcessed: data.status === 'matched' || data.status === 'confirmed',
    processedOrderId: data.status === 'matched' ? data.possibleOrderIds?.[0] : null,
  }).returning();
  
  return payment;
}
