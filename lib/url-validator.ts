/**
 * URL 安全验证工具
 * 防止 SSRF 攻击
 */

// 禁止的主机名模式
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
];

// 禁止的私有 IP 范围
const PRIVATE_IP_RANGES = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^169\.254\./,              // 链路本地
  /^fc00:/i,                  // IPv6 私有地址
  /^fe80:/i,                  // IPv6 链路本地
];

// 禁止的协议
const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:'];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

/**
 * 验证回调 URL 是否安全
 */
export function validateCallbackUrl(urlString: string): UrlValidationResult {
  // 检查是否为空
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: '回调URL不能为空' };
  }

  // 解析 URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: '无效的URL格式' };
  }

  // 检查协议
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: `不支持的协议: ${url.protocol}` };
  }

  // 生产环境强制要求 HTTPS
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    return { valid: false, error: '生产环境必须使用HTTPS' };
  }

  // 检查是否为禁止的协议
  if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
    return { valid: false, error: `禁止的协议: ${url.protocol}` };
  }

  // 检查主机名
  const hostname = url.hostname.toLowerCase();

  // 检查是否为禁止的主机名
  if (BLOCKED_HOSTS.includes(hostname)) {
    return { valid: false, error: `禁止的主机名: ${hostname}` };
  }

  // 检查是否为私有 IP
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { valid: false, error: '禁止访问内网地址' };
    }
  }

  // 检查是否为 IP 地址的其他变体
  // 例如: 0x7f000001 (127.0.0.1 的十六进制形式)
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { valid: false, error: '禁止使用数字IP格式' };
  }

  // 检查端口（可选：限制常用端口）
  const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (port < 1 || port > 65535) {
    return { valid: false, error: '无效的端口号' };
  }

  // 禁止访问某些敏感端口
  const SENSITIVE_PORTS = [22, 23, 25, 110, 143, 993, 995, 3306, 5432, 6379, 27017];
  if (SENSITIVE_PORTS.includes(port)) {
    return { valid: false, error: `禁止访问端口: ${port}` };
  }

  return { valid: true, url };
}

/**
 * 创建带超时的 fetch 请求
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
