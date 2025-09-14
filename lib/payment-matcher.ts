/**
 * 智能支付匹配系统
 * 通过金额和时间窗口匹配支付与订单
 */

import {
  savePendingOrder,
  updatePendingOrder,
  getActivePendingOrders,
  cleanupExpiredPendingOrders,
  saveUnmatchedPaymentWithStatus,
  getUnmatchedPayments,
  confirmPaymentMatch as dbConfirmPaymentMatch,
} from './db-operations';
import { type PendingOrder, type UnmatchedPayment } from './db/schema';

// 扩展接口以包含状态信息
interface UnmatchedPaymentExtended extends UnmatchedPayment {
  possibleOrderIds?: string[];
  status?: 'unmatched' | 'matched' | 'confirmed' | 'ignored';
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
  // 清理过期订单
  await cleanupExpiredPendingOrders();
  
  const orders = await getActivePendingOrders();
  
  let finalAmount = baseAmount;
  let customAmount: number | undefined;
  
  // 检查是否有相同金额的待支付订单（15分钟内）
  const recentTime = new Date(Date.now() - 15 * 60 * 1000); // 15分钟内
  const conflictingOrders = orders.filter(
    o => Math.abs(o.amount - baseAmount) < 0.01 && // 金额相同
    o.paymentMethod === paymentMethod &&
    new Date(o.createdAt) > recentTime // 15分钟内创建的
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
  
  // 创建待匹配订单
  const pendingOrderData = {
    orderId,
    amount: finalAmount,
    paymentMethod,
    status: 'pending' as const,
    customAmount,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟过期，与订单过期时间一致（上海时间）
  };
  
  await savePendingOrder(pendingOrderData);
  
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
  paymentId: string
): Promise<{ matched: boolean; orderId?: string; confidence?: number }> {
  // 清理过期订单
  await cleanupExpiredPendingOrders();
  
  // 获取活跃订单
  const activeOrders = await getActivePendingOrders();
  
  
  // 查找匹配的订单
  const matchingOrders = activeOrders.filter(
    o => Math.abs(o.amount - amount) < 0.01 && // 允许1分钱误差
    o.paymentMethod === paymentMethod
  );
  
  if (matchingOrders.length === 0) {
    // 没有匹配的订单，保存为未匹配支付
    await saveUnmatchedPaymentWithStatus({
      paymentId,
      amount,
      paymentMethod,
      source: 'webhook',
      possibleOrderIds: [],
      status: 'unmatched'
    });
    
    console.log(`未找到匹配订单: 金额 ¥${amount}, 方式 ${paymentMethod}`);
    return { matched: false };
  }
  
  if (matchingOrders.length === 1) {
    // 唯一匹配，高置信度
    const order = matchingOrders[0];
    await updatePendingOrder(order.orderId, { status: 'matched' });
    
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
  await saveUnmatchedPaymentWithStatus({
    paymentId,
    amount,
    paymentMethod,
    source: 'webhook',
    possibleOrderIds: matchingOrders.map(o => o.orderId),
    status: 'unmatched'
  });
  
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
  try {
    // 使用数据库操作来确认匹配
    await dbConfirmPaymentMatch(paymentId, orderId);
    
    // 更新待匹配订单状态
    await updatePendingOrder(orderId, { status: 'matched' });
    
    console.log(`手动确认匹配: ${orderId} <- ${paymentId}`);
    return true;
  } catch (error) {
    console.error(`确认匹配失败: ${paymentId} -> ${orderId}`, error);
    return false;
  }
}

/**
 * 获取待确认的支付
 */
export async function getUnconfirmedPayments(): Promise<{
  payment: UnmatchedPaymentExtended;
  possibleOrders: PendingOrder[];
}[]> {
  const payments = await getUnmatchedPayments();
  const orders = await getActivePendingOrders();
  
  // 解析未匹配支付中的状态信息
  const unconfirmedPayments = payments
    .filter(p => !p.isProcessed)
    .map(payment => {
      // 解析rawMessage中的状态和可能的订单ID
      const rawMessage = payment.rawMessage || '';
      const possibleOrdersMatch = rawMessage.match(/PossibleOrders: ([^\n]*)/);
      const statusMatch = rawMessage.match(/Status: ([^\n]*)/);
      
      const possibleOrderIds = possibleOrdersMatch 
        ? possibleOrdersMatch[1].split(',').filter(id => id.trim())
        : [];
      const status = statusMatch?.[1]?.trim() as 'unmatched' | 'matched' | 'confirmed' | 'ignored' || 'unmatched';
      
      return {
        ...payment,
        possibleOrderIds,
        status
      } as UnmatchedPaymentExtended;
    })
    .filter(p => p.status === 'unmatched');
  
  return unconfirmedPayments.map(payment => ({
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
  try {
    const payments = await getUnmatchedPayments();
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) {
      console.log(`未找到支付: ${paymentId}`);
      return false;
    }
    
    if (payment.isProcessed) {
      console.log(`支付已处理: ${paymentId}`);
      return false;
    }
    
    // 更新rawMessage标记为已忽略
    let updatedMessage = payment.rawMessage || '';
    const statusMatch = updatedMessage.match(/Status: ([^\n]*)/);
    
    if (statusMatch) {
      updatedMessage = updatedMessage.replace(/Status: ([^\n]*)/, 'Status: ignored');
    } else {
      updatedMessage = updatedMessage + '\nStatus: ignored';
    }
    
    // 使用数据库操作更新，标记为已处理并设置特殊的忽略标识
    await dbConfirmPaymentMatch(paymentId, 'IGNORED');
    
    console.log(`已忽略支付: ${paymentId}`);
    return true;
  } catch (error) {
    console.error(`忽略支付失败: ${paymentId}`, error);
    return false;
  }
}

/**
 * 清理过期数据
 */
export async function cleanupExpiredData(): Promise<void> {
  // 清理过期的待匹配订单
  await cleanupExpiredPendingOrders();
  
  console.log('清理过期数据完成');
}