import { NextResponse } from 'next/server';
import { retryFailedCallbacks, sendCallbackNotification, retrySinglePaymentCallback } from '@/lib/callback';
import { getDemoOrderById } from '@/lib/db-operations';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 处理强制回调（没有支付记录的订单）
    if (body.forceCallback && body.orderId) {
      try {
        const order = await getDemoOrderById(body.orderId);
        if (!order) {
          return NextResponse.json(
            { error: '订单不存在' },
            { status: 404 }
          );
        }

        // 获取订单的商户ID
        const orderMerchantId = order.merchantId || 'default';

        // 创建虚拟支付数据进行回调
        const callbackData = {
          orderId: order.orderId,
          amount: order.amount,
          uid: order.orderId, // 使用订单ID作为UID
          paymentMethod: order.paymentMethod || 'unknown',
          status: 'success',
          timestamp: new Date().toISOString(),
          merchantId: orderMerchantId // 包含商户ID
        };

        const callbackResult = await sendCallbackNotification(callbackData, orderMerchantId);
        
        if (callbackResult.success) {
          return NextResponse.json({
            success: 1,
            failed: 0,
            message: '强制回调发送成功'
          });
        } else {
          return NextResponse.json({
            success: 0,
            failed: 1,
            error: callbackResult.error || '强制回调发送失败'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('强制回调失败:', error);
        return NextResponse.json(
          { error: '强制回调失败' },
          { status: 500 }
        );
      }
    }

    // 处理指定支付ID的回调
    if (body.paymentIds && Array.isArray(body.paymentIds)) {
      if (body.paymentIds.length === 1) {
        // 单个支付记录回调
        const result = await retrySinglePaymentCallback(body.paymentIds[0]);
        
        if (result.success) {
          return NextResponse.json({
            success: 1,
            failed: 0,
            message: '回调发送成功'
          });
        } else {
          return NextResponse.json({
            success: 0,
            failed: 1,
            error: result.error || '回调发送失败'
          }, { status: 400 });
        }
      } else {
        // 多个支付记录批量回调（保持原有逻辑，但限制循环）
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];
        
        for (const paymentId of body.paymentIds) {
          const result = await retrySinglePaymentCallback(paymentId);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
            if (result.error) {
              errors.push(result.error);
            }
          }
        }
        
        return NextResponse.json({
          success: successCount,
          failed: failedCount,
          message: `重试完成: ${successCount} 个成功, ${failedCount} 个失败`,
          errors: errors.length > 0 ? errors : undefined
        }, failedCount > 0 ? { status: 400 } : {});
      }
    }

    // 默认处理：重试所有失败的回调
    const successCount = await retryFailedCallbacks();
    return NextResponse.json({
      success: successCount,
      failed: 0,
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