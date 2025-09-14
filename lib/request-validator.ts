import { NextRequest } from 'next/server';

export interface RequestValidationConfig {
  maxBodySize: number;
  requiredFields: string[];
  allowedContentType: string[];
  maxRequestAge: number;
}

export class RequestValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function validateRequestSize(body: string, maxSize: number = 1024 * 1024): void {
  if (Buffer.byteLength(body, 'utf8') > maxSize) {
    throw new RequestValidationError(
      `请求体过大，最大允许${maxSize}字节`,
      'REQUEST_TOO_LARGE'
    );
  }
}

export function validateContentType(request: NextRequest, allowedTypes: string[]): void {
  const contentType = request.headers.get('content-type') || '';
  const isAllowed = allowedTypes.some(type => contentType.includes(type));
  
  if (!isAllowed) {
    throw new RequestValidationError(
      `不支持的Content-Type: ${contentType}`,
      'INVALID_CONTENT_TYPE'
    );
  }
}

export function validateJsonStructure(body: string): any {
  try {
    const parsed = JSON.parse(body);
    
    if (typeof parsed !== 'object' || parsed === null) {
      throw new RequestValidationError('请求体必须是JSON对象', 'INVALID_JSON_STRUCTURE');
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof RequestValidationError) {
      throw error;
    }
    throw new RequestValidationError('JSON格式错误', 'MALFORMED_JSON');
  }
}

export function validateRequiredFields(data: any, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !(field in data) || data[field] === undefined);
  
  if (missingFields.length > 0) {
    throw new RequestValidationError(
      `缺少必需字段: ${missingFields.join(', ')}`,
      'MISSING_REQUIRED_FIELDS'
    );
  }
}

export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return data.trim().replace(/[<>\"'&]/g, '');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

export function validateWebhookRequest(
  request: NextRequest,
  rawBody: string,
  config: RequestValidationConfig
): any {
  validateRequestSize(rawBody, config.maxBodySize);
  validateContentType(request, config.allowedContentType);
  
  const data = validateJsonStructure(rawBody);
  validateRequiredFields(data, config.requiredFields);
  
  return sanitizeInput(data);
}

export function getRequestValidationConfig(): RequestValidationConfig {
  return {
    maxBodySize: 10 * 1024,
    requiredFields: ['message'],
    allowedContentType: ['application/json'],
    maxRequestAge: 300
  };
}

export function validateTimestamp(timestamp: string | null, maxAge: number = 300): void {
  if (!timestamp) {
    throw new RequestValidationError('缺少时间戳', 'MISSING_TIMESTAMP');
  }
  
  const ts = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (isNaN(ts)) {
    throw new RequestValidationError('时间戳格式错误', 'INVALID_TIMESTAMP');
  }
  
  if (Math.abs(currentTime - ts) > maxAge) {
    throw new RequestValidationError(
      `请求时间戳过期，允许的最大时间差为${maxAge}秒`,
      'TIMESTAMP_EXPIRED'
    );
  }
}

export function detectSuspiciousPatterns(data: any): boolean {
  const suspiciousPatterns = [
    /script.*>/i,
    /javascript:/i,
    /eval\(/i,
    /exec\(/i,
    /<iframe/i,
    /on\w+\s*=/i,
    /\.\.\/\.\.\//,
    /union.*select/i,
    /drop.*table/i
  ];
  
  const dataString = JSON.stringify(data).toLowerCase();
  
  return suspiciousPatterns.some(pattern => pattern.test(dataString));
}