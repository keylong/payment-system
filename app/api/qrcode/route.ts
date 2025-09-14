import { NextRequest, NextResponse } from 'next/server';
import { getActiveQRCodes, saveQRCode, deleteQRCode } from '@/lib/database';

// 获取二维码
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'alipay' | 'wechat' | null;
    
    const qrcodes = await getActiveQRCodes();
    let filtered = qrcodes;
    
    // 按类型筛选
    if (type) {
      filtered = filtered.filter(qr => qr.type === type);
    }
    
    // 返回第一个匹配的二维码
    const qrCode = filtered[0];
    
    if (!qrCode) {
      // 如果没有可用的二维码，返回占位符
      return NextResponse.json({
        qrCode: generatePlaceholderQR(type === 'alipay' ? '支付宝' : type === 'wechat' ? '微信' : '收款'),
        type: type || 'alipay',
        id: 'placeholder'
      });
    }
    
    return NextResponse.json({
      qrCode: qrCode.imageUrl,
      type: qrCode.type,
      id: qrCode.id
    });

  } catch (error) {
    console.error('获取二维码错误:', error);
    return NextResponse.json(
      { error: '获取二维码失败' },
      { status: 500 }
    );
  }
}

// 上传二维码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, image, name, description } = body;
    
    if (!type || !image) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const qrCodeData = {
      name: name || `${type === 'alipay' ? '支付宝' : '微信'}收款码`,
      type,
      imageUrl: image,
      description: description || '',
      isActive: true,
      sortOrder: 0
    };
    
    const newQRCode = await saveQRCode(qrCodeData);
    
    return NextResponse.json({
      success: true,
      qrCode: newQRCode
    });

  } catch (error) {
    console.error('上传二维码错误:', error);
    return NextResponse.json(
      { error: '上传失败' },
      { status: 500 }
    );
  }
}

// 删除二维码
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: '缺少ID参数' },
        { status: 400 }
      );
    }
    
    await deleteQRCode(id);
    
    return NextResponse.json({
      success: true,
      message: '删除成功'
    });

  } catch (error) {
    console.error('删除二维码错误:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}

// 生成占位符二维码（SVG格式）
function generatePlaceholderQR(text: string): string {
  const svg = `
    <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#f0f0f0"/>
      <text x="128" y="100" text-anchor="middle" font-size="20" fill="#666">
        ${text}收款码
      </text>
      <text x="128" y="130" text-anchor="middle" font-size="14" fill="#999">
        请在管理后台上传
      </text>
      <rect x="48" y="150" width="160" height="80" fill="#ddd" rx="4"/>
      <text x="128" y="195" text-anchor="middle" font-size="12" fill="#666">
        点击上传二维码
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}