import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const QRCODES_FILE = path.join(process.cwd(), 'data', 'qrcodes.json');

async function ensureQRCodesFile() {
  try {
    await fs.access(QRCODES_FILE);
  } catch {
    await fs.writeFile(QRCODES_FILE, JSON.stringify([]), 'utf-8');
  }
}

export async function GET() {
  try {
    await ensureQRCodesFile();
    const data = await fs.readFile(QRCODES_FILE, 'utf-8');
    const qrCodes = JSON.parse(data);
    
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