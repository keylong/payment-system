import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRecords } from '@/lib/database';
import fs from 'fs/promises';
import path from 'path';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'demo-orders.json');

async function getOrders() {
  try {
    const data = await fs.readFile(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { error: '缺少订单号' },
        { status: 400 }
      );
    }

    // 先查询演示订单
    const orders = await getOrders();
    const order = orders.find((o: any) => o.orderId === orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 检查订单是否超时（15分钟）
    const now = new Date();
    const orderCreated = new Date(order.createdAt);
    const timeoutMinutes = 15;
    const isExpired = (now.getTime() - orderCreated.getTime()) > (timeoutMinutes * 60 * 1000);
    
    // 如果订单超时且状态还是pending，设置为expired
    if (isExpired && order.status === 'pending') {
      order.status = 'expired';
      
      // 保存更新后的订单状态
      const allOrders = await getOrders();
      const index = allOrders.findIndex((o: any) => o.orderId === orderId);
      if (index !== -1) {
        allOrders[index] = order;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(allOrders, null, 2), 'utf-8');
      }
      
      console.log(`订单 ${orderId} 已超时，状态更新为 expired`);
    }

    // 只有pending状态的订单才检查支付记录
    let payment = null;
    if (order.status === 'pending' && !isExpired) {
      const payments = await getPaymentRecords();
      payment = payments.find(p => p.uid === orderId && p.status === 'success');
    }
    
    // 如果找到支付记录，更新订单状态
    if (payment && order.status === 'pending') {
      order.status = 'success';
      order.paidAt = payment.createdAt;
      order.paymentId = payment.id;
      
      // 保存更新后的订单
      const allOrders = await getOrders();
      const index = allOrders.findIndex((o: any) => o.orderId === orderId);
      if (index !== -1) {
        allOrders[index] = order;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(allOrders, null, 2), 'utf-8');
      }
    }

    return NextResponse.json({
      orderId: order.orderId,
      status: order.status,
      amount: order.actualAmount || order.amount,  // 实际支付金额
      displayAmount: order.displayAmount || order.amount,  // 显示金额
      paymentMethod: order.paymentMethod,
      productName: order.productName,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      paymentId: order.paymentId
    });

  } catch (error) {
    console.error('查询订单状态错误:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}