import fs from 'fs/promises';
import path from 'path';
import { PaymentInfo } from './parser';

export interface PaymentRecord extends PaymentInfo {
  id: string;
  source: string;
  timestamp: Date;
  rawMessage: string;
  status: 'pending' | 'success' | 'failed';
  notifications?: NotificationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRecord {
  id: string;
  url: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  response?: string;
  createdAt: Date;
}

export interface NotificationUrl {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  enabled: boolean;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DB_PATH = path.join(process.cwd(), 'data');
const PAYMENTS_FILE = path.join(DB_PATH, 'payments.json');
const MERCHANTS_FILE = path.join(DB_PATH, 'merchants.json');
const NOTIFICATION_URLS_FILE = path.join(DB_PATH, 'notification_urls.json');

async function ensureDbExists() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(DB_PATH, { recursive: true });
  }

  try {
    await fs.access(PAYMENTS_FILE);
  } catch {
    await fs.writeFile(PAYMENTS_FILE, JSON.stringify([]), 'utf-8');
  }

  try {
    await fs.access(MERCHANTS_FILE);
  } catch {
    const defaultMerchant = {
      id: 'default',
      name: '默认商户',
      callbackUrl: process.env.MERCHANT_CALLBACK_URL || 'http://localhost:3001/callback',
      apiKey: process.env.MERCHANT_API_KEY || 'test-api-key-123456',
      createdAt: new Date().toISOString()
    };
    await fs.writeFile(MERCHANTS_FILE, JSON.stringify([defaultMerchant]), 'utf-8');
  }
}

export async function savePaymentRecord(data: Omit<PaymentRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<PaymentRecord> {
  await ensureDbExists();
  
  const records = await getPaymentRecords();
  
  const newRecord: PaymentRecord = {
    ...data,
    id: generateId(),
    status: 'success',
    callbackStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  records.push(newRecord);
  
  await fs.writeFile(PAYMENTS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  
  return newRecord;
}

export async function getPaymentRecords(): Promise<PaymentRecord[]> {
  await ensureDbExists();
  
  try {
    const data = await fs.readFile(PAYMENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取支付记录失败:', error);
    return [];
  }
}

export async function getPaymentById(id: string): Promise<PaymentRecord | null> {
  const records = await getPaymentRecords();
  return records.find(r => r.id === id) || null;
}

export async function updatePaymentRecord(id: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord | null> {
  const records = await getPaymentRecords();
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) {
    return null;
  }
  
  records[index] = {
    ...records[index],
    ...updates,
    updatedAt: new Date()
  };
  
  await fs.writeFile(PAYMENTS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  
  return records[index];
}

export async function getMerchantConfig(): Promise<any> {
  await ensureDbExists();
  
  try {
    const data = await fs.readFile(MERCHANTS_FILE, 'utf-8');
    const merchants = JSON.parse(data);
    return merchants[0] || null;
  } catch (error) {
    console.error('读取商户配置失败:', error);
    return null;
  }
}

export async function updateMerchantConfig(config: any): Promise<void> {
  await ensureDbExists();
  
  try {
    const data = await fs.readFile(MERCHANTS_FILE, 'utf-8');
    const merchants = JSON.parse(data);
    
    if (merchants.length > 0) {
      merchants[0] = { ...merchants[0], ...config, updatedAt: new Date().toISOString() };
    } else {
      merchants.push({ ...config, id: 'default', createdAt: new Date().toISOString() });
    }
    
    await fs.writeFile(MERCHANTS_FILE, JSON.stringify(merchants, null, 2), 'utf-8');
  } catch (error) {
    console.error('更新商户配置失败:', error);
    throw error;
  }
}

function generateId(): string {
  return `PAY${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

export async function getStatistics() {
  const records = await getPaymentRecords();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayRecords = records.filter(r => new Date(r.createdAt) >= today);
  
  const pendingNotifications = records.reduce((sum, r) => {
    if (r.notifications) {
      return sum + r.notifications.filter(n => n.status === 'pending').length;
    }
    return sum;
  }, 0);
  
  return {
    total: records.length,
    todayCount: todayRecords.length,
    todayAmount: todayRecords.reduce((sum, r) => sum + r.amount, 0),
    totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
    successCount: records.filter(r => r.status === 'success').length,
    failedCount: records.filter(r => r.status === 'failed').length,
    pendingCallbacks: pendingNotifications
  };
}

export async function getNotificationUrls(): Promise<NotificationUrl[]> {
  await ensureDbExists();
  
  try {
    await fs.access(NOTIFICATION_URLS_FILE);
    const data = await fs.readFile(NOTIFICATION_URLS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveNotificationUrl(url: Omit<NotificationUrl, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): Promise<NotificationUrl> {
  const urls = await getNotificationUrls();
  
  const newUrl: NotificationUrl = {
    ...url,
    id: `URL${Date.now()}`,
    successCount: 0,
    failureCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  urls.push(newUrl);
  await fs.writeFile(NOTIFICATION_URLS_FILE, JSON.stringify(urls, null, 2), 'utf-8');
  
  return newUrl;
}

export async function updateNotificationUrl(id: string, updates: Partial<NotificationUrl>): Promise<NotificationUrl | null> {
  const urls = await getNotificationUrls();
  const index = urls.findIndex(u => u.id === id);
  
  if (index === -1) return null;
  
  urls[index] = {
    ...urls[index],
    ...updates,
    updatedAt: new Date()
  };
  
  await fs.writeFile(NOTIFICATION_URLS_FILE, JSON.stringify(urls, null, 2), 'utf-8');
  return urls[index];
}

export async function deleteNotificationUrl(id: string): Promise<boolean> {
  const urls = await getNotificationUrls();
  const filtered = urls.filter(u => u.id !== id);
  
  if (filtered.length === urls.length) return false;
  
  await fs.writeFile(NOTIFICATION_URLS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  return true;
}