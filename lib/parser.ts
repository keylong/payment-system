export type PaymentType = 'normal' | 'appreciation' | 'redpacket' | 'transfer';

export interface PaymentInfo {
  amount: number;
  uid: string;
  customerType?: string;
  paymentMethod: 'alipay' | 'wechat' | 'unknown';
  paymentType: PaymentType;
  needsMatching: boolean;
  parsedAt: Date;
}

const AMOUNT_PATTERNS: RegExp[] = [
  /(?:赞赏到账|打赏到账|红包到账|微信红包|转账到账|转账到帐|已到账|到账|到帐)[^\d]{0,8}([\d]+(?:\.\d+)?)\s*元/,
  /(?:收款|收到|已收款|成功收款|入账|消费)[^\d]{0,8}([\d]+(?:\.\d+)?)\s*元/,
  /([\d]+(?:\.\d+)?)\s*元(?:已?到账|已?到帐|已?收款|已?入账|已?转入)/,
  /微信支付[^：:]*[：:]?\s*[^\d]{0,12}([\d]+(?:\.\d+)?)\s*元/,
  /支付宝[^：:]*[：:]?\s*[^\d]{0,12}([\d]+(?:\.\d+)?)\s*元/,
  /([\d]+(?:\.\d+)?)\s*元/,
];

const APPRECIATION_KEYWORDS = ['赞赏到账', '赞赏', '打赏', '微信红包', '红包到账', '红包'];
const TRANSFER_KEYWORDS = ['转账到账', '转账到帐', '转账'];

export function parsePaymentMessage(message: string): PaymentInfo | null {
  try {
    const isAlipay = message.includes('com.eg.android.AlipayGphone') ||
                     message.includes('支付宝') ||
                     message.includes('余额');

    const isWechat = message.includes('com.tencent.mm') ||
                     message.includes('微信');

    let amount: number | null = null;
    for (const pattern of AMOUNT_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }

    if (amount === null) {
      console.log('未找到有效金额信息');
      return null;
    }

    const isAppreciation = APPRECIATION_KEYWORDS.some(k => message.includes(k));
    const isTransfer = !isAppreciation && TRANSFER_KEYWORDS.some(k => message.includes(k));

    let paymentType: PaymentType = 'normal';
    if (isAppreciation) {
      paymentType = message.includes('红包') ? 'redpacket' : 'appreciation';
    } else if (isTransfer) {
      paymentType = 'transfer';
    }

    const orderUidMatch = message.match(/订单号[：:]\s*([A-Za-z0-9_-]+)/i);
    const explicitUidMatch = message.match(/(?:订单UID|订单ID|商户订单)[：:]\s*([A-Za-z0-9_-]+)/i);
    const genericUidMatch = message.match(/UID[：:]\s*([A-Za-z0-9_-]+)/i) ||
                            message.match(/用户ID[：:]\s*([A-Za-z0-9_-]+)/i);

    let uid: string;
    let needsMatching = false;

    if (orderUidMatch) {
      uid = orderUidMatch[1];
    } else if (explicitUidMatch) {
      uid = explicitUidMatch[1];
    } else if (paymentType !== 'normal') {
      // 赞赏/红包/转账场景：消息中的UID通常是付款人ID而非订单号，
      // 强制走金额智能匹配，避免错把付款人ID当订单号写入。
      uid = generateAutoOrderId();
      needsMatching = true;
    } else if (genericUidMatch && genericUidMatch[1] && genericUidMatch[1] !== '0') {
      uid = genericUidMatch[1];
    } else {
      uid = generateAutoOrderId();
      needsMatching = true;
    }

    let customerType: string | undefined;
    if (message.includes('老顾客')) {
      customerType = '老顾客';
    } else if (message.includes('新客户') || message.includes('新顾客')) {
      customerType = '新客户';
    } else if (paymentType === 'appreciation') {
      customerType = '赞赏';
    } else if (paymentType === 'redpacket') {
      customerType = '红包';
    } else if (paymentType === 'transfer') {
      customerType = '转账';
    }

    const paymentMethod = isAlipay ? 'alipay' :
                         isWechat ? 'wechat' :
                         'unknown';

    return {
      amount,
      uid,
      customerType,
      paymentMethod,
      paymentType,
      needsMatching,
      parsedAt: new Date()
    };

  } catch (error) {
    console.error('解析支付消息失败:', error);
    return null;
  }
}

function generateAutoOrderId(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AUTO${timestamp}${random}`;
}

export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function validateWebhookData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

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
