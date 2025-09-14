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

export async function getDemoOrderById(orderId: string): Promise<DemoOrder | null> {
  const [order] = await db.select().from(demoOrders).where(eq(demoOrders.orderId, orderId));
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
  // 今日统计
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayStats] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<number>`COALESCE(sum(amount), 0)::real`
  }).from(payments).where(
    and(
      gte(payments.createdAt, today),
      lte(payments.createdAt, tomorrow)
    )
  );

  // 总统计
  const [totalStats] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<number>`COALESCE(sum(amount), 0)::real`
  }).from(payments);

  // 成功支付统计
  const [successStats] = await db.select({
    count: sql<number>`count(*)::int`
  }).from(payments).where(eq(payments.status, 'success'));

  // 订单统计
  const [orderStats] = await db.select({
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    success: sql<number>`count(*) filter (where status = 'success')::int`,
    expired: sql<number>`count(*) filter (where status = 'expired')::int`,
    total: sql<number>`count(*)::int`
  }).from(demoOrders);

  return {
    todayPayments: todayStats.count,
    todayAmount: todayStats.total,
    totalPayments: totalStats.count,
    totalAmount: totalStats.total,
    successRate: totalStats.count > 0 ? (successStats.count / totalStats.count * 100).toFixed(1) : '0',
    pendingOrders: orderStats.pending,
    successOrders: orderStats.success,
    expiredOrders: orderStats.expired,
    totalOrders: orderStats.total
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