import { NextResponse } from 'next/server';
import { retryFailedCallbacks } from '@/lib/callback';

export async function POST() {
  try {
    const successCount = await retryFailedCallbacks();
    return NextResponse.json({
      success: successCount,
      message: `重试完成: ${successCount} 个回调成功`
    });
  } catch (error) {
    console.error('重试回调失败:', error);
    return NextResponse.json(
      { error: '重试失败' },
      { status: 500 }
    );
  }
}