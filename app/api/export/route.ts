import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRecords } from '@/lib/database';
import { formatAmount } from '@/lib/parser';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let records = await getPaymentRecords();

    // 日期过滤
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      records = records.filter(record => {
        const recordDate = new Date(record.createdAt);
        return recordDate >= start && recordDate <= end;
      });
    }

    // 根据格式导出
    if (format === 'csv') {
      const csv = generateCSV(records);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payments_${Date.now()}.csv"`
        }
      });
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        count: records.length,
        exportDate: new Date().toISOString(),
        data: records.map(record => ({
          id: record.id,
          amount: record.amount,
          uid: record.uid,
          paymentMethod: record.paymentMethod,
          status: record.status,
          callbackStatus: record.callbackStatus,
          customerType: record.customerType,
          source: record.source,
          timestamp: record.timestamp,
          createdAt: record.createdAt
        }))
      }, {
        headers: {
          'Content-Disposition': `attachment; filename="payments_${Date.now()}.json"`
        }
      });
    } else {
      return NextResponse.json(
        { error: '不支持的导出格式' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('导出数据错误:', error);
    return NextResponse.json(
      { error: '导出失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

function generateCSV(records: any[]): string {
  // CSV 头部
  const headers = [
    '订单ID',
    '金额',
    'UID',
    '支付方式',
    '客户类型',
    '状态',
    '回调状态',
    '来源',
    '时间戳',
    '创建时间'
  ];

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF';
  
  const rows = records.map(record => {
    return [
      record.id,
      record.amount,
      record.uid,
      record.paymentMethod === 'alipay' ? '支付宝' : record.paymentMethod === 'wechat' ? '微信' : '未知',
      record.customerType || '',
      record.status === 'success' ? '成功' : '失败',
      record.callbackStatus === 'sent' ? '已发送' : record.callbackStatus === 'pending' ? '待发送' : '失败',
      record.source,
      new Date(record.timestamp).toLocaleString('zh-CN'),
      new Date(record.createdAt).toLocaleString('zh-CN')
    ].map(field => {
      // 处理包含逗号、引号或换行的字段
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });

  return BOM + headers.join(',') + '\n' + rows.join('\n');
}