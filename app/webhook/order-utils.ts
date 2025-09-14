import { getOrderById, updateOrder } from '@/lib/database';
import { formatShanghaiTime, isExpiredAfterMinutes } from '@/lib/timezone';

export async function checkOrderExpiration(orderId: string): Promise<boolean> {
  try {
    const order = await getOrderById(orderId);
    
    if (!order) {
      console.log(`订单不存在: ${orderId}`);
      return true; // 订单不存在，视为已过期
    }
    
    if (order.status !== 'pending') {
      const isExpired = order.status === 'expired';
      console.log(`订单 ${orderId} 状态为 ${order.status}，${isExpired ? '已过期' : '未过期'}`);
      return isExpired; // 非pending状态，根据实际状态判断
    }
    
    // 检查是否超时（15分钟）
    const orderCreated = new Date(order.createdAt);
    const isExpired = isExpiredAfterMinutes(orderCreated, 15);
    
    console.log(`订单 ${orderId} 过期检查: 创建时间=${formatShanghaiTime(orderCreated)}, 当前上海时间=${formatShanghaiTime(new Date())}, 过期=${isExpired}`);
    
    // 如果超时，更新订单状态为过期
    if (isExpired) {
      await updateOrder(orderId, { status: 'expired' });
      console.log(`订单 ${orderId} 已自动过期`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`检查订单过期失败: ${orderId}`, error);
    return true; // 出错时视为已过期，拒绝支付
  }
}