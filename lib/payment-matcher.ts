/**
 * 智能支付匹配系统
 * 通过金额和时间窗口匹配支付与订单
 */

import fs from 'fs/promises';
import path from 'path';

interface PendingOrder {
  orderId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat';
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'matched' | 'expired';
  customAmount?: number; // 用于随机小额
}

interface UnmatchedPayment {
  paymentId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat';
  receivedAt: Date;
  status: 'unmatched' | 'matched' | 'confirmed' | 'ignored';
  possibleOrderIds?: string[];
}

const PENDING_ORDERS_FILE = path.join(process.cwd(), 'data', 'pending-orders.json');
const UNMATCHED_PAYMENTS_FILE = path.join(process.cwd(), 'data', 'unmatched-payments.json');

// 确保文件存在
async function ensureFiles() {
  try {
    await fs.access(PENDING_ORDERS_FILE);
  } catch {
    await fs.writeFile(PENDING_ORDERS_FILE, JSON.stringify([]), 'utf-8');
  }
  
  try {
    await fs.access(UNMATCHED_PAYMENTS_FILE);
  } catch {
    await fs.writeFile(UNMATCHED_PAYMENTS_FILE, JSON.stringify([]), 'utf-8');
  }
}

// 获取待匹配订单
async function getPendingOrders(): Promise<PendingOrder[]> {
  await ensureFiles();
  const data = await fs.readFile(PENDING_ORDERS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 保存待匹配订单
async function savePendingOrders(orders: PendingOrder[]): Promise<void> {
  await fs.writeFile(PENDING_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

// 获取未匹配支付
async function getUnmatchedPayments(): Promise<UnmatchedPayment[]> {
  await ensureFiles();
  const data = await fs.readFile(UNMATCHED_PAYMENTS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 保存未匹配支付
async function saveUnmatchedPayments(payments: UnmatchedPayment[]): Promise<void> {
  await fs.writeFile(UNMATCHED_PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf-8');
}

/**
 * 创建待匹配订单
 * 智能检测金额冲突，只在必要时添加随机小额
 */
export async function createPendingOrder(
  orderId: string,
  baseAmount: number,
  paymentMethod: 'alipay' | 'wechat',
  useRandomAmount: boolean = true
): Promise<{ orderId: string; amount: number; customAmount?: number }> {
  const orders = await getPendingOrders();
  
  let finalAmount = baseAmount;
  let customAmount: number | undefined;
  
  // 检查是否有相同金额的待支付订单（30分钟内）
  const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30分钟内
  const conflictingOrders = orders.filter(
    o => Math.abs(o.amount - baseAmount) < 0.01 && // 金额相同
    o.status === 'pending' &&
    o.paymentMethod === paymentMethod &&
    new Date(o.createdAt) > recentTime // 30分钟内创建的
  );
  
  // 只有在存在冲突时才添加随机小额
  if (useRandomAmount && conflictingOrders.length > 0) {
    console.log(`检测到金额冲突 (¥${baseAmount})，添加叠数小额以区分`);
    
    // 生成叠数小额（11、22、33、44、55、66、77、88、99分）
    const repeatNumbers = [11, 22, 33, 44, 55, 66, 77, 88, 99];
    
    // 随机打乱叠数顺序，避免总是从11开始
    const shuffled = [...repeatNumbers].sort(() => Math.random() - 0.5);
    
    let attempts = 0;
    const maxAttempts = shuffled.length;
    
    for (const cents of shuffled) {
      customAmount = cents / 100;
      const testAmount = Math.floor(baseAmount) + customAmount;
      
      // 检查这个新金额是否也冲突
      const hasConflict = orders.some(
        o => Math.abs(o.amount - testAmount) < 0.01 &&
        o.status === 'pending' &&
        o.paymentMethod === paymentMethod &&
        new Date(o.createdAt) > recentTime
      );
      
      if (!hasConflict) {
        finalAmount = testAmount;
        console.log(`使用叠数小额: ${cents}分`);
        break;
      }
      
      attempts++;
    }
    
    if (attempts === maxAttempts) {
      // 如果所有叠数都冲突，尝试使用三位叠数（111-999）
      const threeDigitRepeats = [111, 222, 333, 444, 555, 666, 777, 888, 999];
      
      for (const cents of threeDigitRepeats) {
        // 转换为元，比如111分 = 1.11元
        customAmount = cents / 100;
        const testAmount = Math.floor(baseAmount) + customAmount;
        
        const hasConflict = orders.some(
          o => Math.abs(o.amount - testAmount) < 0.01 &&
          o.status === 'pending' &&
          o.paymentMethod === paymentMethod &&
          new Date(o.createdAt) > recentTime
        );
        
        if (!hasConflict) {
          finalAmount = testAmount;
          console.log(`使用三位叠数: ${cents}分`);
          break;
        }
      }
      
      if (finalAmount === baseAmount) {
        console.warn(`所有叠数都冲突，使用原金额: ¥${baseAmount}`);
        customAmount = undefined;
      }
    }
  } else if (conflictingOrders.length === 0) {
    console.log(`无金额冲突，使用原金额: ¥${baseAmount}`);
  }
  
  const pendingOrder: PendingOrder = {
    orderId,
    amount: finalAmount,
    paymentMethod,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
    status: 'pending',
    customAmount
  };
  
  orders.push(pendingOrder);
  await savePendingOrders(orders);
  
  console.log(`创建待匹配订单: ${orderId}, 金额: ¥${finalAmount.toFixed(2)}${customAmount ? ` (含叠数${(customAmount * 100).toFixed(0)}分)` : ''}`);
  
  return { orderId, amount: finalAmount, customAmount };
}

/**
 * 匹配支付与订单
 * 基于金额和时间窗口进行智能匹配
 */
export async function matchPayment(
  amount: number,
  paymentMethod: 'alipay' | 'wechat',
  paymentId: string,
  receivedAt: Date = new Date()
): Promise<{ matched: boolean; orderId?: string; confidence?: number }> {
  const orders = await getPendingOrders();
  const now = new Date();
  
  // 清理过期订单
  const activeOrders = orders.filter(o => {
    if (new Date(o.expiresAt) < now && o.status === 'pending') {
      o.status = 'expired';
      return false;
    }
    return o.status === 'pending';
  });
  
  // 查找匹配的订单
  const matchingOrders = activeOrders.filter(
    o => Math.abs(o.amount - amount) < 0.01 && // 允许1分钱误差
    o.paymentMethod === paymentMethod
  );
  
  if (matchingOrders.length === 0) {
    // 没有匹配的订单，保存为未匹配支付
    const payments = await getUnmatchedPayments();
    payments.push({
      paymentId,
      amount,
      paymentMethod,
      receivedAt,
      status: 'unmatched',
      possibleOrderIds: []
    });
    await saveUnmatchedPayments(payments);
    
    console.log(`未找到匹配订单: 金额 ¥${amount}, 方式 ${paymentMethod}`);
    return { matched: false };
  }
  
  if (matchingOrders.length === 1) {
    // 唯一匹配，高置信度
    const order = matchingOrders[0];
    order.status = 'matched';
    await savePendingOrders(orders);
    
    console.log(`成功匹配订单: ${order.orderId} <- 支付 ¥${amount}`);
    return { matched: true, orderId: order.orderId, confidence: 100 };
  }
  
  // 多个可能的匹配
  // 按时间排序，最早的订单优先
  matchingOrders.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  const mostLikelyOrder = matchingOrders[0];
  const confidence = Math.round(100 / matchingOrders.length);
  
  // 保存为待确认的匹配
  const payments = await getUnmatchedPayments();
  payments.push({
    paymentId,
    amount,
    paymentMethod,
    receivedAt,
    status: 'unmatched',
    possibleOrderIds: matchingOrders.map(o => o.orderId)
  });
  await saveUnmatchedPayments(payments);
  
  console.log(`找到 ${matchingOrders.length} 个可能的订单，建议: ${mostLikelyOrder.orderId}`);
  
  return { 
    matched: true, 
    orderId: mostLikelyOrder.orderId, 
    confidence 
  };
}

/**
 * 手动确认支付匹配
 */
export async function confirmPaymentMatch(
  paymentId: string,
  orderId: string
): Promise<boolean> {
  const orders = await getPendingOrders();
  const payments = await getUnmatchedPayments();
  
  const payment = payments.find(p => p.paymentId === paymentId);
  const order = orders.find(o => o.orderId === orderId);
  
  if (!payment || !order) {
    return false;
  }
  
  // 更新状态
  payment.status = 'matched';
  order.status = 'matched';
  
  await savePendingOrders(orders);
  await saveUnmatchedPayments(payments);
  
  console.log(`手动确认匹配: ${orderId} <- ${paymentId}`);
  return true;
}

/**
 * 获取待确认的支付
 */
export async function getUnconfirmedPayments(): Promise<{
  payment: UnmatchedPayment;
  possibleOrders: PendingOrder[];
}[]> {
  const payments = await getUnmatchedPayments();
  const orders = await getPendingOrders();
  
  // 只返回未匹配的支付，排除已忽略的
  const unconfirmed = payments.filter(p => p.status === 'unmatched');
  
  return unconfirmed.map(payment => ({
    payment,
    possibleOrders: orders.filter(o => 
      payment.possibleOrderIds?.includes(o.orderId) || 
      Math.abs(o.amount - payment.amount) < 0.01
    )
  }));
}

/**
 * 忽略指定的支付
 */
export async function ignorePayment(paymentId: string): Promise<boolean> {
  const payments = await getUnmatchedPayments();
  const payment = payments.find(p => p.paymentId === paymentId);
  
  if (!payment) {
    console.log(`未找到支付: ${paymentId}`);
    return false;
  }
  
  if (payment.status !== 'unmatched') {
    console.log(`支付状态不是未匹配: ${paymentId}, 当前状态: ${payment.status}`);
    return false;
  }
  
  // 更新状态为已忽略
  payment.status = 'ignored';
  
  await saveUnmatchedPayments(payments);
  
  console.log(`已忽略支付: ${paymentId}`);
  return true;
}

/**
 * 清理过期数据
 */
export async function cleanupExpiredData(): Promise<void> {
  const orders = await getPendingOrders();
  const payments = await getUnmatchedPayments();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // 保留24小时内的数据
  const activeOrders = orders.filter(o => 
    new Date(o.createdAt) > oneDayAgo || o.status === 'pending'
  );
  
  const activePayments = payments.filter(p => 
    new Date(p.receivedAt) > oneDayAgo || p.status === 'unmatched'
  );
  
  await savePendingOrders(activeOrders);
  await saveUnmatchedPayments(activePayments);
  
  console.log(`清理完成: 保留 ${activeOrders.length} 个订单, ${activePayments.length} 个支付`);
}