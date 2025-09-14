import { PaymentRecord, getMerchantConfig, updatePaymentRecord } from './database';
import { createMerchantRequest } from './merchant-crypto';

export interface CallbackPayload {
  orderId: string;
  amount: number;
  uid: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
  customerType?: string;
  signature?: string;
}

export async function notifyMerchant(record: PaymentRecord): Promise<boolean> {
  try {
    const merchant = await getMerchantConfig();
    
    if (!merchant || !merchant.callbackUrl) {
      console.log('商户回调URL未配置');
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return false;
    }

    const payload: CallbackPayload = {
      orderId: record.id,
      amount: record.amount,
      uid: record.uid,
      paymentMethod: record.paymentMethod,
      status: record.status,
      timestamp: record.timestamp.toString()
    };
    
    // 只有当customerType存在且不为undefined时才添加
    if (record.customerType && record.customerType !== undefined) {
      payload.customerType = record.customerType;
    }

    console.log('发送回调通知到:', merchant.callbackUrl);
    console.log('回调数据:', payload);

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, merchant.apiKey || '');
    
    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';

    const response = await fetch(merchant.callbackUrl, {
      method: 'POST',
      headers,
      body
    });

    if (response.ok) {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'sent',
        callbackUrl: merchant.callbackUrl
      });
      console.log('回调通知发送成功');
      return true;
    } else {
      console.error('回调通知失败:', response.status, response.statusText);
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return false;
    }

  } catch (error) {
    console.error('发送回调通知时出错:', error);
    await updatePaymentRecord(record.id, {
      callbackStatus: 'failed'
    });
    return false;
  }
}


export async function retryFailedCallbacks(): Promise<number> {
  const { getPaymentRecords } = await import('./database');
  const records = await getPaymentRecords();
  
  const failedRecords = records.filter(r => 
    r.status === 'success' && 
    (r.callbackStatus === 'failed' || r.callbackStatus === 'pending')
  );
  
  let successCount = 0;
  
  for (const record of failedRecords) {
    const success = await notifyMerchant(record);
    if (success) {
      successCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`重试完成: ${successCount}/${failedRecords.length} 个回调成功`);
  return successCount;
}

