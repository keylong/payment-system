import { NextRequest, NextResponse } from 'next/server';
import { getMerchantConfig, updateMerchantConfig } from '@/lib/database';

export async function GET() {
  try {
    const config = await getMerchantConfig();
    return NextResponse.json(config || {
      callbackUrl: '',
      apiKey: ''
    });
  } catch (error) {
    console.error('获取商户配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await updateMerchantConfig(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新商户配置失败:', error);
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}