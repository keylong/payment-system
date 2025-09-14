import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('收到回调通知:', {
      orderId: body.orderId,
      amount: body.amount,
      uid: body.uid,
      status: body.status,
      timestamp: body.timestamp
    });

    // 验证签名
    const { signature, ...data } = body;
    const apiKey = process.env.MERCHANT_API_KEY || 'test-api-key-123456';
    
    // 按字母顺序排序键并构建签名字符串
    const sortedKeys = Object.keys(data).sort();
    const signString = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&') + `&key=${apiKey}`;
    
    const calculatedSignature = crypto
      .createHash('sha256')
      .update(signString)
      .digest('hex');
    
    if (signature !== calculatedSignature) {
      console.error('签名验证失败');
      return NextResponse.json(
        { error: '签名验证失败' },
        { status: 401 }
      );
    }

    // 处理回调逻辑
    // 这里可以添加自定义的业务逻辑
    console.log('回调处理成功:', body.orderId);

    return NextResponse.json({
      success: true,
      message: '回调处理成功',
      orderId: body.orderId
    });

  } catch (error) {
    console.error('回调处理错误:', error);
    return NextResponse.json(
      { 
        error: '处理失败', 
        message: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/callback',
    method: 'POST',
    description: '接收支付回调通知的端点',
    parameters: {
      orderId: '订单ID',
      amount: '支付金额',
      uid: '用户ID',
      paymentMethod: '支付方式',
      status: '支付状态',
      timestamp: '时间戳',
      signature: '签名'
    }
  });
}