import { NextRequest } from 'next/server';
import { getConfig } from './system-config';

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function validateApiKey(request: NextRequest): Promise<void> {
  const apiKey = request.headers.get('key');
  const validKey = await getConfig('webhook.api_key');
  
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

// 验证管理员身份认证
export function isAuthenticated(request: NextRequest): boolean {
  try {
    const sessionCookie = request.cookies.get('payment_admin_session');
    if (!sessionCookie) {
      return false;
    }

    const sessionData = JSON.parse(sessionCookie.value);
    const currentTime = Date.now();

    // 检查session是否过期
    if (currentTime > sessionData.expiresAt) {
      return false;
    }

    // 检查session是否有效
    return sessionData.isAuthenticated === true && sessionData.username === 'admin';
  } catch (error) {
    console.error('验证身份认证失败:', error);
    return false;
  }
}