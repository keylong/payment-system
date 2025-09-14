export interface EnvConfig {
  webhookApiKey: string;
  merchantCallbackUrl?: string;
  merchantApiKey?: string;
  nodeEnv: string;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

export function validateEnvironment(): EnvConfig {
  const webhookApiKey = process.env.WEBHOOK_API_KEY;
  const merchantCallbackUrl = process.env.MERCHANT_CALLBACK_URL;
  const merchantApiKey = process.env.MERCHANT_API_KEY;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!webhookApiKey) {
    throw new EnvValidationError('WEBHOOK_API_KEY环境变量是必需的');
  }

  if (webhookApiKey.length < 32) {
    throw new EnvValidationError('WEBHOOK_API_KEY长度不能少于32个字符');
  }

  if (nodeEnv === 'production') {
    if (webhookApiKey.includes('test') || webhookApiKey.includes('123')) {
      throw new EnvValidationError('生产环境不能使用测试密钥');
    }
    
    if (!merchantApiKey || merchantApiKey.includes('test') || merchantApiKey.includes('123')) {
      throw new EnvValidationError('生产环境必须配置安全的商户API密钥');
    }
  }

  return {
    webhookApiKey,
    merchantCallbackUrl,
    merchantApiKey,
    nodeEnv
  };
}

export function isSecureApiKey(key: string): boolean {
  if (key.length < 32) return false;
  if (/^[a-zA-Z0-9-_]{32,}$/.test(key) === false) return false;
  if (key.includes('test') || key.includes('123') || key.includes('password')) return false;
  
  const entropy = calculateEntropy(key);
  return entropy > 4.0;
}

function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const length = str.length;
  
  for (const count of Object.values(freq)) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}