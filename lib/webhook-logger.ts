import { NextRequest } from 'next/server';
import { formatShanghaiTime } from './timezone';

export interface WebhookLogEntry {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  ip: string;
  userAgent?: string;
  contentLength: number;
  error?: string;
  stage: string;
  signature?: string;
}

export class WebhookLogger {
  private static instance: WebhookLogger;
  private logs: WebhookLogEntry[] = [];

  static getInstance(): WebhookLogger {
    if (!WebhookLogger.instance) {
      WebhookLogger.instance = new WebhookLogger();
    }
    return WebhookLogger.instance;
  }

  log(request: NextRequest, body: string, stage: string, error?: string): WebhookLogEntry {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const logEntry: WebhookLogEntry = {
      timestamp: formatShanghaiTime(new Date()),
      method: request.method || 'UNKNOWN',
      url: request.url || '',
      headers,
      body: body.length > 1000 ? body.substring(0, 1000) + '...[truncated]' : body,
      ip: this.getClientIp(request),
      userAgent: headers['user-agent'],
      contentLength: Buffer.byteLength(body, 'utf8'),
      stage,
      error,
      signature: headers['x-signature']
    };

    this.logs.push(logEntry);
    
    // 只保留最近100条日志
    if (this.logs.length > 100) {
      this.logs.shift();
    }

    // 控制台输出详细信息
    this.printDetailedLog(logEntry);

    return logEntry;
  }

  private printDetailedLog(entry: WebhookLogEntry): void {
    console.log('\n=== WEBHOOK详细日志 ===');
    console.log(`时间: ${entry.timestamp}`);
    console.log(`阶段: ${entry.stage}`);
    console.log(`方法: ${entry.method}`);
    console.log(`URL: ${entry.url}`);
    console.log(`客户端IP: ${entry.ip}`);
    console.log(`User-Agent: ${entry.userAgent || '未提供'}`);
    console.log(`Content-Length: ${entry.contentLength} bytes`);
    
    console.log('\n--- 请求头 ---');
    Object.entries(entry.headers).forEach(([key, value]) => {
      // 隐藏敏感信息
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('authorization')) {
        console.log(`${key}: ${this.maskSensitive(value)}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });

    console.log('\n--- 请求体 ---');
    console.log(entry.body);

    if (entry.signature) {
      console.log(`\n--- 签名信息 ---`);
      console.log(`签名: ${entry.signature.substring(0, 20)}...`);
    }

    if (entry.error) {
      console.log(`\n--- 错误信息 ---`);
      console.log(`❌ ${entry.error}`);
    } else {
      console.log(`\n✅ 阶段通过: ${entry.stage}`);
    }
    
    console.log('======================\n');
  }

  private maskSensitive(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIp) {
      return realIp;
    }
    if (remoteAddr) {
      return remoteAddr;
    }
    return 'unknown';
  }

  getLogs(): WebhookLogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 10): WebhookLogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
    console.log('Webhook日志已清除');
  }

  logSecurityCheck(request: NextRequest, body: string, checkType: string, passed: boolean, details?: string): void {
    const stage = `安全检查: ${checkType}`;
    const error = passed ? undefined : `${checkType}失败: ${details || '未知错误'}`;
    this.log(request, body, stage, error);
  }

  logValidation(request: NextRequest, body: string, validationType: string, passed: boolean, details?: string): void {
    const stage = `验证: ${validationType}`;
    const error = passed ? undefined : `${validationType}失败: ${details || '未知错误'}`;
    this.log(request, body, stage, error);
  }
}

export const webhookLogger = WebhookLogger.getInstance();