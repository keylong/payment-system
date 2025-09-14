import { NextResponse } from 'next/server';
import { getPaymentStatistics } from '@/lib/database';

export async function GET() {
  try {
    const stats = await getPaymentStatistics();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}