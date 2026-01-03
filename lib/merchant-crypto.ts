import crypto from 'crypto';

export interface MerchantSignatureConfig {
  apiKey: string;
  timestamp?: number;
  nonce?: string;
}

export interface SignedPayload {
  [key: string]: unknown;
  timestamp: number;
  nonce: string;
  signature: string;
}

/**
 * 生成随机字符串（用作nonce）
 */
export function generateNonce(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * 生成商户端签名
 * 标准签名流程：
 * 1. 将所有参数（除signature外）按key字典序排序
 * 2. 拼接成 key1=value1&key2=value2&...&key={apiKey} 格式
 * 3. 使用HMAC-SHA256生成签名
 */
export function generateMerchantSignature(
  params: Record<string, unknown>,
  config: MerchantSignatureConfig
): string {
  const timestamp = config.timestamp || Math.floor(Date.now() / 1000);
  const nonce = config.nonce || generateNonce();
  
  // 合并所有参数
  const allParams = {
    ...params,
    timestamp,
    nonce,
    api_key: config.apiKey
  };
  
  // 按key字典序排序
  const sortedKeys = Object.keys(allParams).sort();
  
  // 拼接签名字符串，过滤undefined值
  const signString = sortedKeys
    .filter(key => allParams[key as keyof typeof allParams] !== undefined && allParams[key as keyof typeof allParams] !== null)
    .map(key => `${key}=${allParams[key as keyof typeof allParams]}`)
    .join('&');

  // 生成HMAC-SHA256签名
  const signature = crypto
    .createHmac('sha256', config.apiKey)
    .update(signString)
    .digest('hex');
  
  return signature;
}

/**
 * 验证商户端签名
 */
export function verifyMerchantSignature(
  params: Record<string, unknown>,
  signature: string,
  apiKey: string,
  maxAge: number = 300
): boolean {
  try {
    const { timestamp, nonce, ...otherParams } = params;

    // 类型检查和转换
    if (typeof timestamp !== 'number' || typeof nonce !== 'string') {
      return false;
    }

    // 验证时间戳
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > maxAge) {
      return false;
    }

    // 重新生成签名进行比较
    const expectedSignature = generateMerchantSignature(otherParams, {
      apiKey,
      timestamp,
      nonce
    });

    // 使用constant-time比较防止时序攻击
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return isValid;

  } catch (error) {
    console.error('签名验证异常:', error);
    return false;
  }
}

/**
 * 为数据添加商户签名
 */
export function signMerchantData(
  data: Record<string, unknown>,
  apiKey: string
): SignedPayload {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  
  const signature = generateMerchantSignature(data, {
    apiKey,
    timestamp,
    nonce
  });
  
  return {
    ...data,
    timestamp,
    nonce,
    signature
  };
}

/**
 * 创建商户API请求
 */
export function createMerchantRequest(
  data: Record<string, unknown>,
  apiKey: string
): {
  body: string;
  headers: Record<string, string>;
} {
  const signedData = signMerchantData(data, apiKey);
  
  return {
    body: JSON.stringify(signedData),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MerchantSDK/1.0',
      'X-Request-Id': generateNonce(32)
    }
  };
}

/**
 * 验证商户回调请求
 */
export function validateMerchantCallback(
  body: string,
  headers: Record<string, string>,
  apiKey: string
): boolean {
  try {
    const data = JSON.parse(body);
    const { signature, ...params } = data;

    if (!signature) {
      return false;
    }

    return verifyMerchantSignature(params, signature, apiKey);

  } catch (error) {
    console.error('回调验证失败:', error);
    return false;
  }
}