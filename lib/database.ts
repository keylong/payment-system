// 这是新的数据库操作文件，使用PostgreSQL替代JSON文件存储
// 保持与原来database.ts相同的接口，以便无缝迁移

import {
  savePaymentRecord as dbSavePayment,
  getPaymentRecords as dbGetPayments,
  getPaymentById as dbGetPaymentById,
  updatePaymentRecord as dbUpdatePayment,
  saveDemoOrder as dbSaveDemoOrder,
  getDemoOrders as dbGetDemoOrders,
  getDemoOrderById as dbGetDemoOrderById,
  updateDemoOrder as dbUpdateDemoOrder,
  getExpiredOrders as dbGetExpiredOrders,
  markExpiredOrders as dbMarkExpiredOrders,
  getMerchantConfig as dbGetMerchantConfig,
  updateMerchantConfig as dbUpdateMerchantConfig,
  getQRCodes as dbGetQRCodes,
  getActiveQRCodes as dbGetActiveQRCodes,
  saveQRCode as dbSaveQRCode,
  updateQRCode as dbUpdateQRCode,
  deleteQRCode as dbDeleteQRCode,
  saveUnmatchedPayment as dbSaveUnmatchedPayment,
  getUnmatchedPayments as dbGetUnmatchedPayments,
  confirmPaymentMatch as dbConfirmPaymentMatch,
  getPaymentStatistics as dbGetPaymentStatistics,
} from './db-operations';

// 保持原来的接口类型定义
export interface PaymentRecord {
  id: string;
  amount: number;
  uid: string;
  paymentMethod: 'alipay' | 'wechat';
  status: 'success' | 'failed';
  source: 'webhook' | 'manual';
  customerType: string | null;
  rawMessage: string | null;
  matchConfidence: number | null;
  callbackStatus: string | null;
  callbackUrl: string | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoOrder {
  orderId: string;
  productName: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat';
  status: 'pending' | 'success' | 'failed' | 'expired';
  paymentId?: string;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  expiresAt: Date;
  createdAt: Date;
}

export interface MerchantConfig {
  callbackUrl?: string;
  apiKey?: string;
  name?: string;
  description?: string;
}

export interface QRCodeInfo {
  id: string;
  name: string;
  type: 'alipay' | 'wechat';
  imageUrl: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UnmatchedPayment {
  id: string;
  amount: number;
  uid: string;
  paymentMethod: 'alipay' | 'wechat';
  customerType?: string;
  rawMessage?: string;
  source: string;
  timestamp: Date;
  isProcessed: boolean;
  processedOrderId?: string;
  paymentId?: string;
  receivedAt?: Date;
}

// 支付记录操作
export async function savePaymentRecord(data: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<PaymentRecord> {
  const result = await dbSavePayment(data);
  return {
    ...result,
    timestamp: new Date(result.timestamp),
    createdAt: new Date(result.createdAt),
    paymentMethod: result.paymentMethod as 'alipay' | 'wechat',
    status: result.status as 'success' | 'failed',
    source: result.source as 'webhook' | 'manual'
  };
}

export async function getPaymentRecords(): Promise<PaymentRecord[]> {
  const results = await dbGetPayments();
  return results.map(r => ({
    ...r,
    timestamp: new Date(r.timestamp),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    paymentMethod: r.paymentMethod as 'alipay' | 'wechat',
    status: r.status as 'success' | 'failed',
    source: r.source as 'webhook' | 'manual'
  }));
}

export async function getPaymentById(id: string): Promise<PaymentRecord | null> {
  const result = await dbGetPaymentById(id);
  if (!result) return null;
  
  return {
    ...result,
    timestamp: new Date(result.timestamp),
    createdAt: new Date(result.createdAt),
    paymentMethod: result.paymentMethod as 'alipay' | 'wechat',
    status: result.status as 'success' | 'failed',
    source: result.source as 'webhook' | 'manual'
  };
}

export async function updatePaymentRecord(id: string, data: Partial<PaymentRecord>): Promise<void> {
  await dbUpdatePayment(id, data);
}

// 演示订单操作
export async function saveDemoOrder(data: Omit<DemoOrder, 'createdAt'>): Promise<DemoOrder> {
  const result = await dbSaveDemoOrder({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return {
    ...result,
    createdAt: new Date(result.createdAt),
    expiresAt: new Date(result.expiresAt),
    paymentMethod: result.paymentMethod as 'alipay' | 'wechat',
    status: result.status as 'pending' | 'success' | 'failed' | 'expired',
    paymentId: result.paymentId ?? undefined,
    customerInfo: result.customerInfo ?? undefined
  };
}

export async function getDemoOrders(): Promise<DemoOrder[]> {
  const results = await dbGetDemoOrders();
  return results.map(r => ({
    ...r,
    createdAt: new Date(r.createdAt),
    expiresAt: new Date(r.expiresAt),
    paymentMethod: r.paymentMethod as 'alipay' | 'wechat',
    status: r.status as 'pending' | 'success' | 'failed' | 'expired',
    paymentId: r.paymentId ?? undefined,
    customerInfo: r.customerInfo ?? undefined
  }));
}

export async function getDemoOrderById(orderId: string): Promise<DemoOrder | null> {
  const result = await dbGetDemoOrderById(orderId);
  if (!result) return null;
  
  return {
    ...result,
    createdAt: new Date(result.createdAt),
    expiresAt: new Date(result.expiresAt),
    paymentMethod: result.paymentMethod as 'alipay' | 'wechat',
    status: result.status as 'pending' | 'success' | 'failed' | 'expired',
    paymentId: result.paymentId ?? undefined,
    customerInfo: result.customerInfo ?? undefined
  };
}

export async function updateDemoOrder(orderId: string, data: Partial<DemoOrder>): Promise<void> {
  await dbUpdateDemoOrder(orderId, data);
}

// 正式订单操作（使用同一个数据库表）
export async function saveOrder(data: Omit<DemoOrder, 'createdAt'>): Promise<DemoOrder> {
  return await saveDemoOrder(data);
}

export async function getOrders(): Promise<DemoOrder[]> {
  return await getDemoOrders();
}

export async function getOrderById(orderId: string): Promise<DemoOrder | null> {
  return await getDemoOrderById(orderId);
}

export async function updateOrder(orderId: string, data: Partial<DemoOrder>): Promise<void> {
  await updateDemoOrder(orderId, data);
}

export async function getExpiredOrders(): Promise<DemoOrder[]> {
  const results = await dbGetExpiredOrders();
  return results.map(r => ({
    ...r,
    createdAt: new Date(r.createdAt),
    expiresAt: new Date(r.expiresAt),
    paymentMethod: r.paymentMethod as 'alipay' | 'wechat',
    status: r.status as 'pending' | 'success' | 'failed' | 'expired',
    paymentId: r.paymentId ?? undefined,
    customerInfo: r.customerInfo ?? undefined
  }));
}

export async function markExpiredOrders(): Promise<void> {
  await dbMarkExpiredOrders();
}

// 商户配置操作
export async function getMerchantConfig(): Promise<MerchantConfig | null> {
  const result = await dbGetMerchantConfig();
  if (!result) return null;
  
  return {
    callbackUrl: result.callbackUrl || undefined,
    apiKey: result.apiKey || undefined,
    name: result.name || undefined,
    description: result.description || undefined
  };
}

export async function updateMerchantConfig(data: MerchantConfig): Promise<void> {
  await dbUpdateMerchantConfig(data);
}

// 二维码操作  
export async function getQRCodes(): Promise<QRCodeInfo[]> {
  const results = await dbGetQRCodes();
  return results.map(r => ({
    ...r,
    type: r.type as 'alipay' | 'wechat',
    description: r.description ?? undefined,
    isActive: r.isActive ?? false,
    sortOrder: r.sortOrder ?? 0
  }));
}

export async function getActiveQRCodes(): Promise<QRCodeInfo[]> {
  const results = await dbGetActiveQRCodes();
  return results.map(r => ({
    ...r,
    type: r.type as 'alipay' | 'wechat',
    description: r.description ?? undefined,
    isActive: r.isActive ?? false,
    sortOrder: r.sortOrder ?? 0
  }));
}

export async function saveQRCode(data: Omit<QRCodeInfo, 'id'>): Promise<QRCodeInfo> {
  const { createId } = await import('@paralleldrive/cuid2');
  const result = await dbSaveQRCode({
    ...data,
    id: createId(),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return {
    ...result,
    type: result.type as 'alipay' | 'wechat',
    description: result.description ?? undefined,
    isActive: result.isActive ?? false,
    sortOrder: result.sortOrder ?? 0
  };
}

export async function updateQRCode(id: string, data: Partial<QRCodeInfo>): Promise<void> {
  await dbUpdateQRCode(id, data);
}

export async function deleteQRCode(id: string): Promise<void> {
  await dbDeleteQRCode(id);
}

// 未匹配支付操作
export async function saveUnmatchedPayment(data: Omit<UnmatchedPayment, 'id' | 'isProcessed' | 'processedOrderId'>): Promise<UnmatchedPayment> {
  const result = await dbSaveUnmatchedPayment(data);
  return {
    ...result,
    timestamp: new Date(result.timestamp),
    paymentMethod: result.paymentMethod as 'alipay' | 'wechat',
    customerType: result.customerType ?? undefined,
    rawMessage: result.rawMessage ?? undefined,
    isProcessed: result.isProcessed ?? false,
    processedOrderId: result.processedOrderId ?? undefined
  };
}

export async function getUnmatchedPayments(): Promise<UnmatchedPayment[]> {
  const results = await dbGetUnmatchedPayments();
  return results.map(r => ({
    ...r,
    timestamp: new Date(r.timestamp),
    paymentMethod: r.paymentMethod as 'alipay' | 'wechat',
    customerType: r.customerType ?? undefined,
    rawMessage: r.rawMessage ?? undefined,
    isProcessed: r.isProcessed ?? false,
    processedOrderId: r.processedOrderId ?? undefined
  }));
}

export async function confirmPaymentMatch(unmatchedId: string, orderId: string): Promise<void> {
  await dbConfirmPaymentMatch(unmatchedId, orderId);
}

// 统计信息
export async function getPaymentStatistics() {
  return await dbGetPaymentStatistics();
}

// 兼容性函数 - 初始化相关
export async function ensureDataStructure(): Promise<void> {
  // PostgreSQL版本不需要初始化文件结构
  console.log('✅ 数据库结构检查完成');
}

// 导出旧版本兼容的函数名
export const initializeDatabase = ensureDataStructure;
export const getStatistics = getPaymentStatistics;