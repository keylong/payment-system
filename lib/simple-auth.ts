import { NextRequest } from 'next/server';

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function validateApiKey(request: NextRequest): void {
  const apiKey = request.headers.get('key');
  const validKey = process.env.WEBHOOK_API_KEY;
  
  console.log('[简单验证] 开始API密钥验证');
  console.log('[简单验证] 收到的API密钥:', apiKey ? `${apiKey.substring(0, 4)}...` : 'null');
  console.log('[简单验证] 期望的API密钥:', validKey ? `${validKey.substring(0, 4)}...` : 'null');
  
  if (!validKey) {
    throw new AuthError('服务器未配置API密钥', 'SERVER_CONFIG_ERROR');
  }
  
  if (!apiKey) {
    throw new AuthError('请求头中缺少key', 'MISSING_API_KEY');
  }
  
  if (apiKey !== validKey) {
    console.log('[简单验证] API密钥不匹配');
    throw new AuthError('API密钥无效', 'INVALID_API_KEY');
  }
  
  console.log('[简单验证] API密钥验证通过');
}