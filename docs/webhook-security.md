# Webhook安全机制说明

## 安全特性

### 1. 签名验证
- 使用HMAC-SHA256算法生成签名
- 结合时间戳防止重放攻击
- 使用constant-time比较防止时序攻击

### 2. API密钥验证
- 强制要求API密钥
- 生产环境密钥安全性检查
- 密钥熵值验证

### 3. 请求验证
- 请求体大小限制
- Content-Type验证
- 必需字段检查
- 可疑内容检测

### 4. 时间戳验证
- 防止重放攻击
- 默认5分钟过期时间
- 服务器时间同步验证

## 发送安全Webhook请求

### 客户端示例

```javascript
const crypto = require('crypto');

// 生成安全的webhook请求
function createSecureWebhookRequest(payload, apiKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signString = `${timestamp}.${payloadString}`;
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');

  return {
    url: 'https://your-domain.com/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'X-Payment-System': 'AlipayWechatGateway/1.0'
    },
    body: payloadString
  };
}

// 使用示例
const request = createSecureWebhookRequest({
  message: '收到转账500.00元(微信支付)'
}, 'your-secure-api-key-32-chars-minimum');
```

### Python示例

```python
import json
import time
import hmac
import hashlib
import requests

def create_secure_webhook_request(payload, api_key):
    timestamp = int(time.time())
    payload_string = json.dumps(payload, separators=(',', ':'))
    sign_string = f"{timestamp}.{payload_string}"
    signature = hmac.new(
        api_key.encode('utf-8'),
        sign_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return {
        'url': 'https://your-domain.com/webhook',
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'X-Api-Key': api_key,
            'X-Timestamp': str(timestamp),
            'X-Signature': signature,
            'X-Payment-System': 'AlipayWechatGateway/1.0'
        },
        'data': payload_string
    }

# 使用示例
request_config = create_secure_webhook_request({
    'message': '收到转账500.00元(微信支付)'
}, 'your-secure-api-key-32-chars-minimum')

response = requests.post(
    request_config['url'],
    headers=request_config['headers'],
    data=request_config['data']
)
```

## 环境配置

### 必需的环境变量

```bash
# Webhook API密钥 (至少32个字符)
WEBHOOK_API_KEY=your-secure-api-key-here

# 商户回调配置
MERCHANT_CALLBACK_URL=https://your-merchant-site.com/payment-callback
MERCHANT_API_KEY=your-merchant-api-key

# 环境
NODE_ENV=production
```

### 生产环境要求

1. **API密钥要求**：
   - 至少32个字符
   - 不能包含'test'、'123'等弱密码标识
   - 熵值必须大于4.0

2. **网络安全**：
   - 使用HTTPS
   - 配置防火墙限制访问来源
   - 启用请求限流

## 错误处理

### 常见错误代码

- `MISSING_API_KEY`: 缺少API密钥
- `INVALID_API_KEY`: API密钥无效
- `MISSING_SIGNATURE`: 缺少签名
- `SIGNATURE_VERIFICATION_FAILED`: 签名验证失败
- `TIMESTAMP_EXPIRED`: 时间戳过期
- `REQUEST_TOO_LARGE`: 请求体过大
- `SUSPICIOUS_CONTENT`: 检测到可疑内容

### 调试建议

1. 检查时间戳是否在有效范围内（5分钟）
2. 验证签名计算方式是否正确
3. 确保API密钥配置正确
4. 检查Content-Type是否为application/json
5. 验证请求体大小是否超过限制（10KB）

## 安全最佳实践

1. **定期轮换密钥**
2. **监控异常请求**
3. **设置访问日志**
4. **使用HTTPS**
5. **限制来源IP**
6. **配置适当的超时时间**