'use client';

const ADMIN_USERNAME = 'admin';
const AUTH_KEY = 'payment_system_auth';

// 获取管理员密码（从环境变量或默认值）
function getAdminPassword(): string {
  // 在客户端环境中，我们需要通过API调用来验证密码
  // 这里先使用环境变量的默认值，实际验证通过API进行
  return process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '34073969';
}

export interface AuthState {
  isAuthenticated: boolean;
  username?: string;
}

// 检查用户是否已登录
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const authData = localStorage.getItem(AUTH_KEY);
    if (!authData) return false;
    
    const { isAuthenticated, timestamp, username } = JSON.parse(authData);
    
    // 检查是否过期（24小时）
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000; // 24小时
    
    if (now - timestamp > expiry) {
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
    
    return isAuthenticated === true && username === ADMIN_USERNAME;
  } catch (error) {
    console.error('认证检查失败:', error);
    localStorage.removeItem(AUTH_KEY);
    return false;
  }
}

// 登录（异步验证密码）
export async function login(username: string, password: string): Promise<boolean> {
  try {
    // 调用API验证密码
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const authData = {
          isAuthenticated: true,
          username,
          timestamp: Date.now()
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('登录请求失败:', error);
    return false;
  }
}

// 同步登录（仅用于客户端验证已存储的session）
export function loginSync(username: string, password: string): boolean {
  const adminPassword = getAdminPassword();
  if (username === ADMIN_USERNAME && password === adminPassword) {
    const authData = {
      isAuthenticated: true,
      username,
      timestamp: Date.now()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
    return true;
  }
  return false;
}

// 登出
export async function logout(): Promise<void> {
  try {
    // 调用服务端登出API
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('登出API调用失败:', error);
  } finally {
    // 无论API调用是否成功，都清除本地存储
    localStorage.removeItem(AUTH_KEY);
  }
}

// 同步登出（仅清除本地存储）
export function logoutSync(): void {
  localStorage.removeItem(AUTH_KEY);
}

// 获取认证状态
export function getAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false };
  }
  
  try {
    const authData = localStorage.getItem(AUTH_KEY);
    if (!authData) {
      return { isAuthenticated: false };
    }
    
    const { isAuthenticated: auth, username, timestamp } = JSON.parse(authData);
    
    // 检查是否过期
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000; // 24小时
    
    if (now - timestamp > expiry) {
      localStorage.removeItem(AUTH_KEY);
      return { isAuthenticated: false };
    }
    
    return {
      isAuthenticated: auth === true,
      username
    };
  } catch (error) {
    console.error('获取认证状态失败:', error);
    localStorage.removeItem(AUTH_KEY);
    return { isAuthenticated: false };
  }
}