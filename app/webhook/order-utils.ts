import fs from 'fs/promises';
import path from 'path';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'demo-orders.json');

interface DemoOrder {
  orderId: string;
  status: 'pending' | 'success' | 'expired';
  createdAt: string;
  [key: string]: any;
}

async function getOrders(): Promise<DemoOrder[]> {
  try {
    const data = await fs.readFile(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveOrders(orders: DemoOrder[]): Promise<void> {
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

export async function checkOrderExpiration(orderId: string): Promise<boolean> {
  const orders = await getOrders();
  const order = orders.find(o => o.orderId === orderId);
  
  if (!order) {
    return true; // 订单不存在，视为已过期
  }
  
  if (order.status !== 'pending') {
    return order.status === 'expired'; // 非pending状态，根据实际状态判断
  }
  
  // 检查是否超时（15分钟）
  const now = new Date();
  const orderCreated = new Date(order.createdAt);
  const timeoutMinutes = 15;
  const isExpired = (now.getTime() - orderCreated.getTime()) > (timeoutMinutes * 60 * 1000);
  
  // 如果超时，更新订单状态为过期
  if (isExpired) {
    order.status = 'expired';
    const index = orders.findIndex(o => o.orderId === orderId);
    if (index !== -1) {
      orders[index] = order;
      await saveOrders(orders);
      console.log(`订单 ${orderId} 已自动过期`);
    }
    return true;
  }
  
  return false;
}