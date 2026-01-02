import { PaymentRecord, updatePaymentRecord, getDemoOrderByPaymentId } from './database';
import { createMerchantRequest } from './merchant-crypto';
import { formatShanghaiTime } from './timezone';
import { getConfig } from './system-config';
import { getMerchantById, ensureDefaultMerchant } from './db-operations';

export interface CallbackPayload {
  orderId: string;
  amount: number;
  uid: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
  customerType?: string;
  merchantId?: string; // 商户ID
  signature?: string;
  [key: string]: unknown;
}

// 获取商户回调配置（支持多商户）
async function getMerchantCallbackConfig(merchantId?: string): Promise<{
  callbackUrl: string | null;
  apiKey: string | null;
  retryTimes: number;
  timeout: number;
}> {
  // 如果指定了商户ID且不是default，尝试从商户表获取配置
  if (merchantId && merchantId !== 'default') {
    const merchant = await getMerchantById(merchantId);
    if (merchant && merchant.isActive && merchant.callbackUrl) {
      return {
        callbackUrl: merchant.callbackUrl,
        apiKey: merchant.apiKey || null,
        retryTimes: merchant.callbackRetryTimes ?? 3,
        timeout: merchant.callbackTimeout ?? 30,
      };
    }
  }

  // 回退到默认商户配置
  const defaultMerchant = await getMerchantById('default');
  if (defaultMerchant && defaultMerchant.callbackUrl) {
    return {
      callbackUrl: defaultMerchant.callbackUrl,
      apiKey: defaultMerchant.apiKey || null,
      retryTimes: defaultMerchant.callbackRetryTimes ?? 3,
      timeout: defaultMerchant.callbackTimeout ?? 30,
    };
  }

  // 最后回退到系统配置（向下兼容）
  const callbackUrl = await getConfig('merchant.callback_url');
  const apiKey = await getConfig('merchant.api_key');

  return {
    callbackUrl,
    apiKey,
    retryTimes: 3,
    timeout: 30,
  };
}

export async function notifyMerchant(record: PaymentRecord): Promise<boolean> {
  try {
    // 获取关联订单以确定商户
    const linkedOrder = await getDemoOrderByPaymentId(record.id);
    const merchantId = (record as PaymentRecord & { merchantId?: string }).merchantId
      || (linkedOrder as { merchantId?: string } | null)?.merchantId
      || 'default';

    // 获取商户回调配置
    const { callbackUrl, apiKey } = await getMerchantCallbackConfig(merchantId);

    if (!callbackUrl) {
      console.log('商户回调URL未配置, merchantId:', merchantId);
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return false;
    }

    // 如果已通过智能匹配到订单，则使用匹配到的订单号作为回调的orderId；否则使用内部支付ID
    const resolvedOrderId = linkedOrder?.orderId
      || (typeof record.uid === 'string' && record.uid.startsWith('ORD') ? record.uid : record.id);

    const payload: CallbackPayload = {
      orderId: resolvedOrderId,
      amount: record.amount,
      uid: record.uid,
      paymentMethod: record.paymentMethod,
      status: record.status,
      timestamp: formatShanghaiTime(record.timestamp),
      merchantId: merchantId, // 包含商户ID
    };

    // 只有当customerType存在且不为undefined时才添加
    if (record.customerType && record.customerType !== undefined) {
      payload.customerType = record.customerType;
    }

    console.log('发送回调通知到:', callbackUrl, 'merchantId:', merchantId);
    console.log('回调数据:', payload);

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    headers['X-Merchant-Id'] = merchantId;

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


export async function sendCallbackNotification(callbackData: CallbackPayload, merchantId?: string): Promise<{success: boolean, error?: string}> {
  try {
    // 获取商户回调配置
    const { callbackUrl, apiKey } = await getMerchantCallbackConfig(merchantId || callbackData.merchantId);

    if (!callbackUrl) {
      const errorMsg = '商户回调URL未配置';
      console.log(errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('发送回调通知到:', callbackUrl);
    console.log('回调数据:', callbackData);

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(callbackData, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    if (merchantId || callbackData.merchantId) {
      headers['X-Merchant-Id'] = merchantId || callbackData.merchantId || '';
    }

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

    // 获取关联订单以确定商户
    const linkedOrder = await getDemoOrderByPaymentId(record.id);
    const merchantId = (record as PaymentRecord & { merchantId?: string }).merchantId
      || (linkedOrder as { merchantId?: string } | null)?.merchantId
      || 'default';

    // 获取商户回调配置
    const { callbackUrl, apiKey } = await getMerchantCallbackConfig(merchantId);

    if (!callbackUrl) {
      return { success: false, error: '商户回调URL未配置' };
    }

    // 如果该支付记录曾匹配到订单，使用匹配到的订单号
    const resolvedOrderId = linkedOrder?.orderId
      || (typeof record.uid === 'string' && record.uid.startsWith('ORD') ? record.uid : record.id);

    const payload: CallbackPayload = {
      orderId: resolvedOrderId,
      amount: record.amount,
      uid: record.uid,
      paymentMethod: record.paymentMethod,
      status: record.status,
      timestamp: formatShanghaiTime(record.timestamp),
      merchantId: merchantId,
    };

    // 只有当customerType存在且不为undefined时才添加
    if (record.customerType && record.customerType !== undefined) {
      payload.customerType = record.customerType;
    }

    console.log('发送回调通知到:', callbackUrl, 'merchantId:', merchantId);
    console.log('回调数据:', payload);

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    headers['X-Merchant-Id'] = merchantId;

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
