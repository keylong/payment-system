interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // 清理过期条目
    if (entry && now > entry.resetTime) {
      this.limits.delete(identifier);
    }

    const current = this.limits.get(identifier);
    
    if (!current) {
      // 新条目
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }

    if (current.count >= this.maxRequests) {
      // 超出限制
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }

    // 增加计数
    current.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - current.count,
      resetTime: current.resetTime
    };
  }

  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  // 定期清理过期条目
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// 创建不同用途的限流器
export const webhookLimiter = new RateLimiter(100, 60000); // 每分钟100次
export const apiLimiter = new RateLimiter(1000, 60000); // 每分钟1000次
export const configLimiter = new RateLimiter(10, 60000); // 每分钟10次

// 定期清理
setInterval(() => {
  webhookLimiter.cleanup();
  apiLimiter.cleanup();
  configLimiter.cleanup();
}, 60000);

// 获取客户端IP
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // 默认使用一个固定值（在本地开发时）
  return 'unknown';
}