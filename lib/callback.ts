import { PaymentRecord, updatePaymentRecord } from './database';
import { createMerchantRequest } from './merchant-crypto';
import { formatShanghaiTime } from './timezone';
import { getConfig } from './system-config';

export interface CallbackPayload {
  orderId: string;
  amount: number;
  uid: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
  customerType?: string;
  signature?: string;
  [key: string]: unknown;
}

export async function notifyMerchant(record: PaymentRecord): Promise<boolean> {
  try {
    // 从系统配置获取商户回调URL
    const callbackUrl = await getConfig('merchant.callback_url');
    
    if (!callbackUrl) {
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
      timestamp: formatShanghaiTime(record.timestamp)
    };
    
    // 只有当customerType存在且不为undefined时才添加
    if (record.customerType && record.customerType !== undefined) {
      payload.customerType = record.customerType;
    }

    console.log('发送回调通知到:', callbackUrl);
    console.log('回调数据:', payload);

    // 从系统配置获取商户API密钥
    const merchantApiKey = await getConfig('merchant.api_key');
    
    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, merchantApiKey || '');
    
    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body
    });

    if (response.ok) {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'sent',
        callbackUrl: callbackUrl
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


export async function sendCallbackNotification(callbackData: CallbackPayload): Promise<{success: boolean, error?: string}> {
  try {
    // 从系统配置获取商户回调URL
    const callbackUrl = await getConfig('merchant.callback_url');
    
    if (!callbackUrl) {
      const errorMsg = '商户回调URL未配置';
      console.log(errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('发送回调通知到:', callbackUrl);
    console.log('回调数据:', callbackData);

    // 从系统配置获取商户API密钥
    const merchantApiKey = await getConfig('merchant.api_key');
    
    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(callbackData, merchantApiKey || '');
    
    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body
    });

    if (response.ok) {
      console.log('回调通知发送成功');
      return { success: true };
    } else {
      const errorMsg = `回调通知失败: ${response.status} ${response.statusText}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

  } catch (error) {
    const errorMsg = `发送回调通知时出错: ${error}`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function retrySinglePaymentCallback(paymentId: string): Promise<{success: boolean, error?: string}> {
  try {
    const { getPaymentById } = await import('./database');
    const record = await getPaymentById(paymentId);
    
    if (!record) {
      return { success: false, error: '找不到支付记录' };
    }

    // 从系统配置获取商户回调URL
    const callbackUrl = await getConfig('merchant.callback_url');
    
    if (!callbackUrl) {
      return { success: false, error: '商户回调URL未配置' };
    }

    const payload: CallbackPayload = {
      orderId: record.id,
      amount: record.amount,
      uid: record.uid,
      paymentMethod: record.paymentMethod,
      status: record.status,
      timestamp: formatShanghaiTime(record.timestamp)
    };
    
    // 只有当customerType存在且不为undefined时才添加
    if (record.customerType && record.customerType !== undefined) {
      payload.customerType = record.customerType;
    }

    console.log('发送回调通知到:', callbackUrl);
    console.log('回调数据:', payload);

    // 从系统配置获取商户API密钥
    const merchantApiKey = await getConfig('merchant.api_key');
    
    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, merchantApiKey || '');
    
    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body
    });

    if (response.ok) {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'sent',
        callbackUrl: callbackUrl
      });
      console.log('回调通知发送成功');
      return { success: true };
    } else {
      const errorMsg = `回调通知失败: ${response.status} ${response.statusText}`;
      console.error(errorMsg);
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return { success: false, error: errorMsg };
    }

  } catch (error) {
    const errorMsg = `发送回调通知时出错: ${error}`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
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

