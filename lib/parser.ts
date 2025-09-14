export interface PaymentInfo {
  amount: number;
  uid: string;
  customerType?: string;
  paymentMethod: 'alipay' | 'wechat' | 'unknown';
  parsedAt: Date;
}

export function parsePaymentMessage(message: string): PaymentInfo | null {
  try {
    const isAlipay = message.includes('com.eg.android.AlipayGphone') || 
                     message.includes('支付宝') || 
                     message.includes('余额');
    
    const isWechat = message.includes('com.tencent.mm') || 
                     message.includes('微信');

    const amountMatch = message.match(/收款?([\d.]+)元/);
    if (!amountMatch) {
      console.log('未找到金额信息');
      return null;
    }

    const amount = parseFloat(amountMatch[1]);
    if (isNaN(amount) || amount <= 0) {
      console.log('金额解析失败:', amountMatch[1]);
      return null;
    }

    const uidMatch = message.match(/UID[：:]\s*([A-Za-z0-9_-]+)/i) || 
                     message.match(/用户ID[：:]\s*([A-Za-z0-9_-]+)/i) ||
                     message.match(/订单号[：:]\s*([A-Za-z0-9_-]+)/i);
    
    let uid = uidMatch ? uidMatch[1] : generateOrderId();
    
    // 如果UID是无效值（如 "0"），则生成新的ID
    if (uid === '0' || uid === '' || !uid) {
      uid = generateOrderId();
    }

    let customerType: string | undefined;
    if (message.includes('老顾客')) {
      customerType = '老顾客';
    } else if (message.includes('新客户') || message.includes('新顾客')) {
      customerType = '新客户';
    }

    const paymentMethod = isAlipay ? 'alipay' : 
                         isWechat ? 'wechat' : 
                         'unknown';

    return {
      amount,
      uid,
      customerType,
      paymentMethod,
      parsedAt: new Date()
    };

  } catch (error) {
    console.error('解析支付消息失败:', error);
    return null;
  }
}

function generateOrderId(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${timestamp}${random}`;
}

export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function validateWebhookData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // 类型断言，确保我们可以访问属性
  const obj = data as Record<string, unknown>;
  const requiredFields = ['message', 'timestamp', 'source'];
  
  for (const field of requiredFields) {
    if (!obj[field]) {
      console.log(`缺少必要字段: ${field}`);
      return false;
    }
  }

  if (typeof obj.message !== 'string' || obj.message.trim() === '') {
    console.log('消息内容无效');
    return false;
  }

  const timestamp = new Date(obj.timestamp as string | number);
  if (isNaN(timestamp.getTime())) {
    console.log('时间戳无效');
    return false;
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  
  if (timestamp < thirtyMinutesAgo || timestamp > fiveMinutesFromNow) {
    console.log('时间戳超出合理范围');
    return false;
  }

  return true;
}