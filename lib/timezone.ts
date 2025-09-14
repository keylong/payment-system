/**
 * 时区工具模块 - 统一使用上海时间
 */

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

/**
 * 获取当前上海时间
 */
export function now(): Date {
  return new Date();
}

/**
 * 将日期转换为上海时区的字符串
 */
export function toShanghaiString(date: Date): string {
  return date.toLocaleString('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 将日期转换为上海时区的ISO字符串（用于数据库存储）
 */
export function toShanghaiISO(date: Date): string {
  return new Date(date.getTime()).toISOString();
}

/**
 * 从上海时区字符串创建Date对象
 */
export function fromShanghaiString(dateString: string): Date {
  // 如果字符串不包含时区信息，假设它是上海时间
  if (!dateString.includes('T') && !dateString.includes('+')) {
    // 格式如: "2025-09-14 12:30:00"
    return new Date(dateString + ' GMT+0800');
  }
  return new Date(dateString);
}

/**
 * 获取上海时间的今天开始时间 (00:00:00)
 */
export function getTodayStartInShanghai(): Date {
  const now = new Date();
  const shanghai = new Date(now.toLocaleString('en-US', { timeZone: SHANGHAI_TIMEZONE }));
  shanghai.setHours(0, 0, 0, 0);
  return shanghai;
}

/**
 * 获取上海时间的今天结束时间 (23:59:59)
 */
export function getTodayEndInShanghai(): Date {
  const now = new Date();
  const shanghai = new Date(now.toLocaleString('en-US', { timeZone: SHANGHAI_TIMEZONE }));
  shanghai.setHours(23, 59, 59, 999);
  return shanghai;
}

/**
 * 获取指定分钟后的上海时间
 */
export function getMinutesLaterInShanghai(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * 格式化为用户友好的上海时间显示
 */
export function formatShanghaiTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 检查两个时间的差值（毫秒）
 */
export function getTimeDifferenceMs(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime());
}

/**
 * 检查订单是否在指定分钟内过期
 */
export function isExpiredAfterMinutes(createdAt: Date, minutes: number): boolean {
  const now = new Date();
  const expirationTime = new Date(createdAt.getTime() + minutes * 60 * 1000);
  return now > expirationTime;
}