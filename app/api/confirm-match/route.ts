import { NextRequest, NextResponse } from 'next/server';
import { confirmPaymentMatch } from '@/lib/payment-matcher';
import { updateOrderStatus } from '../demo-order/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, orderId } = body;
    
    if (!paymentId || !orderId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    // 确认匹配
    const success = await confirmPaymentMatch(paymentId, orderId);
    
    if (success) {
      // 更新订单状态
      await updateOrderStatus(orderId, 'success', paymentId);
      
      return NextResponse.json({
        success: true,
        message: '匹配确认成功'
      });
    } else {
      return NextResponse.json(
        { error: '确认失败' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('确认匹配错误:', error);
    return NextResponse.json(
      { error: '处理失败' },
      { status: 500 }
    );
  }
}