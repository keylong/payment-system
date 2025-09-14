import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createPendingOrder } from '@/lib/payment-matcher';

interface DemoOrder {
  orderId: string;
  productId: string;
  productName: string;
  amount: number;
  displayAmount: number;  // 显示金额
  actualAmount: number;   // 实际支付金额（含随机小额）
  paymentMethod: 'alipay' | 'wechat';
  status: 'pending' | 'success' | 'failed';
  createdAt: Date;
  paidAt?: Date;
  paymentId?: string;
}

const ORDERS_FILE = path.join(process.cwd(), 'data', 'demo-orders.json');

async function ensureOrdersFile() {
  try {
    await fs.access(ORDERS_FILE);
  } catch {
    await fs.writeFile(ORDERS_FILE, JSON.stringify([]), 'utf-8');
  }
}

async function getOrders(): Promise<DemoOrder[]> {
  await ensureOrdersFile();
  const data = await fs.readFile(ORDERS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveOrders(orders: DemoOrder[]): Promise<void> {
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

// 创建订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, productName, amount, paymentMethod } = body;

    // 验证参数
    if (!productName || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: '金额必须大于0' },
        { status: 400 }
      );
    }

    // 生成订单号
    const orderId = generateOrderId();
    
    // 使用智能匹配系统创建待匹配订单
    const { amount: actualAmount, customAmount } = await createPendingOrder(
      orderId,
      amount,
      paymentMethod,
      true // 使用随机小额
    );
    
    // 创建订单
    const order: DemoOrder = {
      orderId,
      productId: productId || 'custom',
      productName,
      amount,
      displayAmount: amount,      // 原始金额
      actualAmount: actualAmount,  // 实际支付金额（包含随机小额）
      paymentMethod,
      status: 'pending',
      createdAt: new Date()
    };

    // 保存订单
    const orders = await getOrders();
    orders.push(order);
    await saveOrders(orders);

    console.log('创建演示订单:', order);

    return NextResponse.json({
      success: true,
      orderId,
      amount: actualAmount,  // 返回实际需要支付的金额
      displayAmount: amount,
      paymentMethod,
      message: customAmount 
        ? `订单创建成功！为避免金额重复，实际支付金额为 ¥${actualAmount.toFixed(2)}`
        : '订单创建成功！'
    });

  } catch (error) {
    console.error('创建订单错误:', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    );
  }
}

// 查询订单
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    
    const orders = await getOrders();
    
    if (orderId) {
      const order = orders.find(o => o.orderId === orderId);
      if (!order) {
        return NextResponse.json(
          { error: '订单不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json(order);
    }
    
    // 返回所有订单（最新的在前）
    const sortedOrders = orders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return NextResponse.json({
      orders: sortedOrders.slice(0, 50), // 只返回最新50条
      total: orders.length
    });

  } catch (error) {
    console.error('查询订单错误:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}

// 更新订单状态（内部使用）
export async function updateOrderStatus(
  orderId: string, 
  status: 'success' | 'failed',
  paymentId?: string
): Promise<boolean> {
  try {
    const orders = await getOrders();
    const index = orders.findIndex(o => o.orderId === orderId);
    
    if (index === -1) {
      console.log('订单不存在:', orderId);
      return false;
    }
    
    orders[index].status = status;
    if (status === 'success') {
      orders[index].paidAt = new Date();
      if (paymentId) {
        orders[index].paymentId = paymentId;
      }
    }
    
    await saveOrders(orders);
    console.log('更新订单状态:', orderId, status);
    return true;
    
  } catch (error) {
    console.error('更新订单状态失败:', error);
    return false;
  }
}

// 手动更新订单状态（管理后台使用）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;
    
    if (!orderId || !status) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    if (!['pending', 'success', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      );
    }
    
    const orders = await getOrders();
    const index = orders.findIndex(o => o.orderId === orderId);
    
    if (index === -1) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }
    
    orders[index].status = status;
    if (status === 'success' && !orders[index].paidAt) {
      orders[index].paidAt = new Date();
    } else if (status === 'pending') {
      delete orders[index].paidAt;
      delete orders[index].paymentId;
    }
    
    await saveOrders(orders);
    
    return NextResponse.json({
      success: true,
      message: `订单状态已更新为${status === 'success' ? '已支付' : status === 'pending' ? '待支付' : '失败'}`
    });
    
  } catch (error) {
    console.error('更新订单状态错误:', error);
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    );
  }
}

function generateOrderId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}