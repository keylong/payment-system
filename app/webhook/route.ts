import { NextRequest, NextResponse } from 'next/server';
import { parsePaymentMessage } from '@/lib/parser';
import { savePaymentRecord } from '@/lib/database';
import { notifyMerchant } from '@/lib/callback';
import { webhookLimiter, getClientIp } from '@/lib/rate-limit';
import { validateApiKey, AuthError } from '@/lib/simple-auth';

export async function POST(request: NextRequest) {
  try {
    // 请求限流
    const clientIp = getClientIp(request);
    const rateLimitResult = webhookLimiter.check(clientIp);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      );
    }

    // API密钥验证
    try {
      await validateApiKey(request);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 401 }
        );
      }
      throw error;
    }
    
    const body = await request.json();
    console.log('收到Webhook消息:', body);

    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: '缺少必要字段: message' },
        { status: 400 }
      );
    }

    // 自动生成timestamp和source
    const timestamp = new Date();
    const source = 'webhook';

    const paymentInfo = parsePaymentMessage(message);
    
    if (!paymentInfo) {
      return NextResponse.json(
        { error: '无法解析支付信息' },
        { status: 400 }
      );
    }

    // 尝试智能匹配订单
    const { matchPayment } = await import('@/lib/payment-matcher');
    const matchResult = await matchPayment(
      paymentInfo.amount,
      paymentInfo.paymentMethod as 'alipay' | 'wechat',
      `PAY${Date.now()}`
    );

    // 如果有有效的UID，优先使用UID
    let finalUid = paymentInfo.uid;
    
    // 如果UID是自动生成的或无效的，尝试使用智能匹配
    if (finalUid.startsWith('PAY') || finalUid === '0' || !finalUid) {
      if (matchResult.matched && matchResult.orderId) {
        finalUid = matchResult.orderId;
        console.log(`智能匹配成功: 金额 ¥${paymentInfo.amount} -> 订单 ${finalUid}`);
      }
    }

    const record = await savePaymentRecord({
      amount: paymentInfo.amount,
      uid: finalUid,
      paymentMethod: paymentInfo.paymentMethod === 'unknown' ? 'alipay' : paymentInfo.paymentMethod,
      source: source as 'webhook',
      status: 'success' as const,
      timestamp: new Date(timestamp),
      customerType: paymentInfo.customerType ?? null,
      rawMessage: message,
      matchConfidence: matchResult.confidence ?? null,
      callbackStatus: 'pending' as const,
      callbackUrl: null,
      updatedAt: new Date()
    });

    // 如果匹配成功，检查订单是否过期再更新状态
    if (matchResult.matched && matchResult.orderId) {
      // 检查订单是否过期
      const { checkOrderExpiration } = await import('./order-utils');
      const isExpired = await checkOrderExpiration(matchResult.orderId);
      
      if (!isExpired) {
        const { updateOrderStatus } = await import('../api/orders/route');
        await updateOrderStatus(matchResult.orderId, 'success', record.id);
        console.log(`订单 ${matchResult.orderId} 支付成功`);
      } else {
        console.log(`订单 ${matchResult.orderId} 已过期，拒绝支付`);
      }
    }

    await notifyMerchant(record);

    return NextResponse.json({
      status: 'success',
      orderId: record.id,
      amount: paymentInfo.amount,
      uid: paymentInfo.uid
    });

  } catch (error) {
    console.error('Webhook处理错误:', error);
    return NextResponse.json(
      { error: '处理失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/webhook',
    method: 'POST',
    description: '接收支付通知的Webhook端点'
  });
}