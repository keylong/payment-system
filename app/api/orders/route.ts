import { NextRequest, NextResponse } from 'next/server';
import { saveOrder, getOrderById, updateOrder, getDemoOrdersWithPaymentInfo } from '@/lib/database';
import { createPendingOrder } from '@/lib/payment-matcher';
import type { DemoOrder } from '@/lib/database';

// 创建订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, amount, paymentMethod } = body;

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
    
    // 创建订单对象
    const orderData = {
      orderId,
      productName,
      amount: actualAmount,  // 使用实际支付金额
      paymentMethod,
      status: 'pending' as const,
      customerInfo: {},
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15分钟后过期（上海时间）
    };

    // 保存到数据库
    const order = await saveOrder(orderData);

    console.log('创建订单:', order);

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
    
    if (orderId) {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json(
          { error: '订单不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json(order);
    }
    
    // 获取包含回调信息的所有订单
    const orders = await getDemoOrdersWithPaymentInfo();
    
    return NextResponse.json({
      orders: orders.slice(0, 50), // 只返回最新50条
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
    const order = await getOrderById(orderId);
    
    if (!order) {
      console.log('订单不存在:', orderId);
      return false;
    }
    
    const updateFields: Partial<DemoOrder> = {
      status: status as 'success' | 'failed'
    };
    if (status === 'success' && paymentId) {
      updateFields.paymentId = paymentId;
    }
    
    await updateOrder(orderId, updateFields);
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
    
    if (!['pending', 'success', 'failed', 'expired'].includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      );
    }
    
    const order = await getOrderById(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }
    
    const updateFields: Partial<DemoOrder> = {
      status: status as 'pending' | 'success' | 'failed' | 'expired'
    };
    
    // 如果状态为pending，清除支付信息
    if (status === 'pending') {
      updateFields.paymentId = undefined;
    }
    
    await updateOrder(orderId, updateFields);
    
    const statusTextMap = {
      'success': '已支付',
      'pending': '待支付', 
      'failed': '失败',
      'expired': '已过期'
    } as const;
    
    const statusText = statusTextMap[status as keyof typeof statusTextMap] || status;

    return NextResponse.json({
      success: true,
      message: `订单状态已更新为${statusText}`
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