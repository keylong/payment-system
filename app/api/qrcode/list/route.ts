import { NextResponse } from 'next/server';
import { getQRCodes } from '@/lib/database';

export async function GET() {
  try {
    const qrCodes = await getQRCodes();
    
    return NextResponse.json({
      qrCodes,
      total: qrCodes.length
    });
    
  } catch (error) {
    console.error('获取二维码列表错误:', error);
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    );
  }
}