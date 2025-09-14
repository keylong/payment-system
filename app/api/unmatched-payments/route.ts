import { NextResponse } from 'next/server';
import { getUnconfirmedPayments, ignorePayment } from '@/lib/payment-matcher';

export async function GET() {
  try {
    const unconfirmed = await getUnconfirmedPayments();
    
    return NextResponse.json({
      payments: unconfirmed.map(item => ({
        ...item.payment,
        possibleOrderIds: item.possibleOrders.map(o => o.orderId)
      })),
      total: unconfirmed.length
    });
    
  } catch (error) {
    console.error('获取未匹配支付错误:', error);
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, paymentId } = body;
    
    if (action !== 'ignore' || !paymentId) {
      return NextResponse.json(
        { error: '参数无效' },
        { status: 400 }
      );
    }
    
    const success = await ignorePayment(paymentId);
    
    if (!success) {
      return NextResponse.json(
        { error: '忽略失败：支付不存在或状态不正确' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '支付已忽略'
    });
    
  } catch (error) {
    console.error('忽略支付错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}