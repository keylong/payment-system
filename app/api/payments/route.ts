import { NextResponse } from 'next/server';
import { getPaymentRecords } from '@/lib/database';

export async function GET() {
  try {
    const payments = await getPaymentRecords();
    
    const sortedPayments = payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return NextResponse.json({
      success: true,
      payments: sortedPayments.slice(0, 100)
    });
  } catch (error) {
    console.error('获取支付记录失败:', error);
    return NextResponse.json(
      { error: '获取支付记录失败' },
      { status: 500 }
    );
  }
}