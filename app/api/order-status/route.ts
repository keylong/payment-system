import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRecords, getDemoOrderById, updateDemoOrder, markExpiredOrders } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { error: '缺少订单号' },
        { status: 400 }
      );
    }

    // 先标记过期订单
    await markExpiredOrders();

    // 查询演示订单
    const order = await getDemoOrderById(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 只有pending状态的订单才检查支付记录
    let payment = null;
    if (order.status === 'pending') {
      const payments = await getPaymentRecords();
      payment = payments.find(p => p.uid === orderId && p.status === 'success');
    }
    
    // 如果找到支付记录，更新订单状态
    if (payment && order.status === 'pending') {
      await updateDemoOrder(orderId, {
        status: 'success',
        paymentId: payment.id
      });
      
      // 更新本地order对象以便返回
      order.status = 'success';
      order.paymentId = payment.id;
    }

    return NextResponse.json({
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      productName: order.productName,
      createdAt: order.createdAt,
      paymentId: order.paymentId
    });

  } catch (error) {
    console.error('查询订单状态错误:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}