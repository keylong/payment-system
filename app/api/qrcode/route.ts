import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface QRCode {
  id: string;
  type: 'alipay' | 'wechat';
  image: string;  // Base64 encoded image
  minAmount?: number;
  maxAmount?: number;
  fixedAmount?: number;
  isActive: boolean;
  uploadedAt: Date;
}

const QRCODES_FILE = path.join(process.cwd(), 'data', 'qrcodes.json');

async function ensureQRCodesFile() {
  try {
    await fs.access(QRCODES_FILE);
  } catch {
    // 创建默认二维码（占位符）
    const defaultQRCodes: QRCode[] = [
      {
        id: 'default-alipay',
        type: 'alipay',
        image: generatePlaceholderQR('支付宝'),
        isActive: true,
        uploadedAt: new Date()
      },
      {
        id: 'default-wechat',
        type: 'wechat',
        image: generatePlaceholderQR('微信'),
        isActive: true,
        uploadedAt: new Date()
      }
    ];
    await fs.writeFile(QRCODES_FILE, JSON.stringify(defaultQRCodes, null, 2), 'utf-8');
  }
}

async function getQRCodes(): Promise<QRCode[]> {
  await ensureQRCodesFile();
  const data = await fs.readFile(QRCODES_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveQRCodes(qrcodes: QRCode[]): Promise<void> {
  await fs.writeFile(QRCODES_FILE, JSON.stringify(qrcodes, null, 2), 'utf-8');
}

// 获取二维码
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'alipay' | 'wechat' | null;
    const amount = searchParams.get('amount');
    
    const qrcodes = await getQRCodes();
    let filtered = qrcodes.filter(qr => qr.isActive);
    
    // 按类型筛选
    if (type) {
      filtered = filtered.filter(qr => qr.type === type);
    }
    
    // 按金额筛选
    if (amount) {
      const amountNum = parseFloat(amount);
      filtered = filtered.filter(qr => {
        if (qr.fixedAmount) {
          return qr.fixedAmount === amountNum;
        }
        if (qr.minAmount && qr.maxAmount) {
          return amountNum >= qr.minAmount && amountNum <= qr.maxAmount;
        }
        return true; // 没有金额限制的二维码
      });
    }
    
    // 如果筛选后没有结果，返回默认二维码
    if (filtered.length === 0 && type) {
      filtered = qrcodes.filter(qr => qr.type === type && qr.isActive);
    }
    
    // 返回第一个匹配的二维码
    const qrCode = filtered[0];
    
    if (!qrCode) {
      return NextResponse.json(
        { error: '没有可用的收款码' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      qrCode: qrCode.image,
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
    const { type, image, minAmount, maxAmount, fixedAmount } = body;
    
    if (!type || !image) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const qrcodes = await getQRCodes();
    
    const newQRCode: QRCode = {
      id: `qr-${Date.now()}`,
      type,
      image,
      minAmount,
      maxAmount,
      fixedAmount,
      isActive: true,
      uploadedAt: new Date()
    };
    
    qrcodes.push(newQRCode);
    await saveQRCodes(qrcodes);
    
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
    
    const qrcodes = await getQRCodes();
    const filtered = qrcodes.filter(qr => qr.id !== id);
    
    if (filtered.length === qrcodes.length) {
      return NextResponse.json(
        { error: '二维码不存在' },
        { status: 404 }
      );
    }
    
    await saveQRCodes(filtered);
    
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