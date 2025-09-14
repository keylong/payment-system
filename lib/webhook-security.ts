import crypto from 'crypto';
import { validateEnvironment } from './env-validator';

export interface WebhookSecurityConfig {
  apiKey: string;
  signatureHeader?: string;
  timestampHeader?: string;
  maxAge?: number;
}

export class WebhookSecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WebhookSecurityError';
  }
}

export function generateWebhookSignature(
  payload: string | object,
  apiKey: string,
  timestamp?: number
): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signString = `${ts}.${data}`;
  
  return crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');
}

export function verifyWebhookSignature(
  payload: string | object,
  signature: string,
  apiKey: string,
  timestamp?: number,
  maxAge: number = 300
): boolean {
  try {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (currentTime - ts > maxAge) {
      throw new WebhookSecurityError('请求时间戳过期', 'TIMESTAMP_EXPIRED');
    }
    
    const expectedSignature = generateWebhookSignature(payload, apiKey, ts);
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    if (error instanceof WebhookSecurityError) {
      throw error;
    }
    throw new WebhookSecurityError('签名验证失败', 'SIGNATURE_INVALID');
  }
}

export function validateWebhookRequest(
  request: Request,
  rawBody: string,
  config: WebhookSecurityConfig
): void {
  const apiKey = request.headers.get('x-api-key');
  const signature = request.headers.get(config.signatureHeader || 'x-signature');
  const timestamp = request.headers.get(config.timestampHeader || 'x-timestamp');
  
  console.log('[安全验证] 开始验证webhook请求');
  console.log('[安全验证] 期望的API密钥前8位:', config.apiKey.substring(0, 8));
  console.log('[安全验证] 收到的API密钥:', apiKey ? `${apiKey.substring(0, 8)}...` : 'null');
  console.log('[安全验证] 收到的签名:', signature ? `${signature.substring(0, 16)}...` : 'null');
  console.log('[安全验证] 收到的时间戳:', timestamp);
  
  if (!apiKey) {
    throw new WebhookSecurityError('请求头中缺少x-api-key', 'MISSING_API_KEY');
  }
  
  if (apiKey !== config.apiKey) {
    console.log('[安全验证] API密钥不匹配!');
    console.log('[安全验证] 期望:', config.apiKey);
    console.log('[安全验证] 收到:', apiKey);
    throw new WebhookSecurityError('API密钥无效或不匹配', 'INVALID_API_KEY');
  }
  
  if (!signature) {
    throw new WebhookSecurityError('请求头中缺少x-signature签名', 'MISSING_SIGNATURE');
  }
  
  const ts = timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000);
  console.log('[安全验证] 使用时间戳:', ts);
  
  try {
    if (!verifyWebhookSignature(rawBody, signature, apiKey, ts, config.maxAge)) {
      throw new WebhookSecurityError('签名验证失败，请检查签名计算方式', 'SIGNATURE_VERIFICATION_FAILED');
    }
    console.log('[安全验证] 所有验证通过!');
  } catch (error) {
    if (error instanceof WebhookSecurityError) {
      throw error;
    }
    console.log('[安全验证] 签名验证异常:', error);
    throw new WebhookSecurityError(`签名验证过程出错: ${error}`, 'SIGNATURE_VERIFICATION_ERROR');
  }
}

export function createWebhookPayload(
  data: unknown,
  apiKey: string
): { payload: unknown; headers: Record<string, string> } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(data);
  const signature = generateWebhookSignature(payloadString, apiKey, timestamp);
  
  return {
    payload: data,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'X-Payment-System': 'AlipayWechatGateway/1.0'
    }
  };
}

export function getWebhookSecurityConfig(): WebhookSecurityConfig {
  const env = validateEnvironment();
  
  return {
    apiKey: env.webhookApiKey,
    signatureHeader: 'x-signature',
    timestampHeader: 'x-timestamp',
    maxAge: 300
  };
}