import { NextRequest, NextResponse } from 'next/server';
import { webhookLogger } from '@/lib/webhook-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '20', 10);
    const clear = searchParams.get('clear') === 'true';

    if (clear) {
      webhookLogger.clearLogs();
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook日志已清除' 
      });
    }

    const logs = webhookLogger.getRecentLogs(count);
    
    return NextResponse.json({
      success: true,
      data: {
        logs,
        total: logs.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('获取webhook日志失败:', error);
    return NextResponse.json(
      { 
        error: '获取日志失败', 
        message: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'clear':
        webhookLogger.clearLogs();
        return NextResponse.json({ 
          success: true, 
          message: 'Webhook日志已清除' 
        });

      case 'export':
        const logs = webhookLogger.getLogs();
        return NextResponse.json({
          success: true,
          data: {
            logs,
            exportTime: new Date().toISOString(),
            filename: `webhook-logs-${Date.now()}.json`
          }
        });

      default:
        return NextResponse.json(
          { error: '不支持的操作' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('处理webhook日志操作失败:', error);
    return NextResponse.json(
      { 
        error: '操作失败', 
        message: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    );
  }
}