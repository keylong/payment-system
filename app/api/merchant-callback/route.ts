import { NextRequest, NextResponse } from 'next/server';
import { validateMerchantCallback } from '@/lib/merchant-crypto';
import { getConfig } from '@/lib/system-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers: Record<string, string> = {};
    
    // 转换headers格式
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log('[商户回调验证] 收到回调请求');
    console.log('[商户回调验证] 请求体:', body);
    console.log('[商户回调验证] 请求头:', headers);
    
    // 从数据库配置获取商户API密钥
    const merchantApiKey = await getConfig('merchant.api_key');
    if (!merchantApiKey) {
      return NextResponse.json(
        { error: '服务器未配置商户API密钥' },
        { status: 500 }
      );
    }
    
    // 验证签名
    const isValid = validateMerchantCallback(body, headers, merchantApiKey);
    
    if (!isValid) {
      return NextResponse.json(
        { error: '签名验证失败' },
        { status: 401 }
      );
    }
    
    // 解析数据
    const data = JSON.parse(body);
    
    console.log('[商户回调验证] 验证成功，处理支付回调');
    console.log('[商户回调验证] 订单ID:', data.orderId);
    console.log('[商户回调验证] 支付金额:', data.amount);
    console.log('[商户回调验证] 支付状态:', data.status);
    
    // 这里可以添加商户的业务逻辑
    // 例如：更新订单状态、发送通知等
    
    return NextResponse.json({
      status: 'success',
      message: '回调处理成功',
      orderId: data.orderId
    });
    
  } catch (error) {
    console.error('[商户回调验证] 处理失败:', error);
    return NextResponse.json(
      { error: '处理失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/merchant-callback',
    method: 'POST',
    description: '商户回调验证端点，用于接收和验证支付系统的回调通知'
  });
}