import { PaymentRecord, updatePaymentRecord, getDemoOrderByPaymentId } from './database';
import { createMerchantRequest } from './merchant-crypto';
import { formatShanghaiTime } from './timezone';
import { getConfig } from './system-config';
import { getMerchantById } from './db-operations';
import { validateCallbackUrl, fetchWithTimeout } from './url-validator';

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
    const { callbackUrl, apiKey, timeout } = await getMerchantCallbackConfig(merchantId);

    if (!callbackUrl) {
      console.log('商户回调URL未配置, merchantId:', merchantId);
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return false;
    }

    // 验证回调 URL 安全性
    const urlValidation = validateCallbackUrl(callbackUrl);
    if (!urlValidation.valid) {
      console.error('回调URL验证失败:', urlValidation.error);
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

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    headers['X-Merchant-Id'] = merchantId;

    // 使用带超时的 fetch
    const response = await fetchWithTimeout(callbackUrl, {
      method: 'POST',
      headers,
      body
    }, timeout * 1000);

    if (response.ok) {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'sent',
        callbackUrl: callbackUrl
      });
      return true;
    } else {
      console.error('回调通知失败:', response.status, response.statusText);
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return false;
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('回调请求超时');
    } else {
      console.error('发送回调通知时出错:', error);
    }
    await updatePaymentRecord(record.id, {
      callbackStatus: 'failed'
    });
    return false;
  }
}


export async function sendCallbackNotification(callbackData: CallbackPayload, merchantId?: string): Promise<{success: boolean, error?: string}> {
  try {
    const resolvedMerchantId = merchantId || callbackData.merchantId;

    // 获取商户回调配置
    const { callbackUrl, apiKey, timeout } = await getMerchantCallbackConfig(resolvedMerchantId);

    if (!callbackUrl) {
      return { success: false, error: '商户回调URL未配置' };
    }

    // 验证回调 URL 安全性
    const urlValidation = validateCallbackUrl(callbackUrl);
    if (!urlValidation.valid) {
      return { success: false, error: `回调URL验证失败: ${urlValidation.error}` };
    }

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(callbackData, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    if (merchantId || callbackData.merchantId) {
      headers['X-Merchant-Id'] = merchantId || callbackData.merchantId || '';
    }

    // 使用带超时的 fetch
    const response = await fetchWithTimeout(callbackUrl, {
      method: 'POST',
      headers,
      body
    }, timeout * 1000);

    if (response.ok) {
      return { success: true };
    } else {
      // 尝试获取响应体以便了解错误原因
      let responseBody = '';
      try {
        responseBody = await response.text();
        console.error('[回调失败] 响应体:', responseBody);
      } catch {
        // 忽略读取错误
      }
      return { success: false, error: `回调通知失败: ${response.status} ${response.statusText}` };
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: '回调请求超时' };
    }
    return { success: false, error: `发送回调通知时出错: ${error}` };
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
    const { callbackUrl, apiKey, timeout } = await getMerchantCallbackConfig(merchantId);

    if (!callbackUrl) {
      return { success: false, error: '商户回调URL未配置' };
    }

    // 验证回调 URL 安全性
    const urlValidation = validateCallbackUrl(callbackUrl);
    if (!urlValidation.valid) {
      return { success: false, error: `回调URL验证失败: ${urlValidation.error}` };
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

    // 使用标准商户端加密
    const { body, headers } = createMerchantRequest(payload, apiKey || '');

    // 添加自定义标识头
    headers['X-Payment-System'] = 'AlipayWechatGateway/1.0';
    headers['X-Merchant-Id'] = merchantId;

    // 使用带超时的 fetch
    const response = await fetchWithTimeout(callbackUrl, {
      method: 'POST',
      headers,
      body
    }, timeout * 1000);

    if (response.ok) {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'sent',
        callbackUrl: callbackUrl
      });
      return { success: true };
    } else {
      await updatePaymentRecord(record.id, {
        callbackStatus: 'failed'
      });
      return { success: false, error: `回调通知失败: ${response.status} ${response.statusText}` };
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: '回调请求超时' };
    }
    return { success: false, error: `发送回调通知时出错: ${error}` };
  }
}

export async function retryFailedCallbacks(): Promise<number> {
  const { getPaymentRecords } = await import('./database');
  const records = await getPaymentRecords();

  const failedRecords = records.filter(r =>
    r.status === 'success' &&
    (r.callbackStatus === 'failed' || r.callbackStatus === 'pending')
  );

  if (failedRecords.length === 0) {
    return 0;
  }

  // 使用并发控制，每次最多处理5个
  const CONCURRENCY_LIMIT = 5;
  let successCount = 0;

  for (let i = 0; i < failedRecords.length; i += CONCURRENCY_LIMIT) {
    const batch = failedRecords.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      batch.map(record => notifyMerchant(record))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      }
    }

    // 批次之间添加短暂延迟，避免过载
    if (i + CONCURRENCY_LIMIT < failedRecords.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return successCount;
}
