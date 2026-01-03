# 商户接入指南

## 快速开始

### 接入流程
```
1. 在管理后台创建商户 → 2. 配置回调URL和API密钥 → 3. 调用API创建订单 → 4. 接收支付回调
```

### 创建商户

在管理后台「商户管理」中添加商户：
- **商户代码**: 唯一标识，如 `shop_a`
- **商户名称**: 显示名称
- **回调URL**: 支付成功通知地址
- **API密钥**: 点击「生成密钥」自动生成

---

## API接口

### 创建订单 `POST /api/orders`

```json
{
  "productName": "商品名称",
  "amount": 10.00,
  "paymentMethod": "alipay",
  "merchantCode": "shop_a"
}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| productName | 是 | 商品名称 |
| amount | 是 | 金额（0.01-10000） |
| paymentMethod | 是 | `alipay` 或 `wechat` |
| merchantCode | 否 | 商户代码（不传则使用默认商户） |

**响应**:
```json
{
  "success": true,
  "orderId": "ORD1757825452250764",
  "amount": 10.00,
  "merchantId": "cm1234567890",
  "expiresAt": "2025-01-13 19:40:38"
}
```

### 获取收款二维码 `GET /api/qrcode?type=alipay`

创建订单后，调用此接口获取对应支付方式的收款二维码。

| 参数 | 必填 | 说明 |
|------|------|------|
| type | 是 | `alipay` 或 `wechat` |

**响应**:
```json
{
  "qrCode": "data:image/png;base64,iVBOR...",
  "type": "alipay",
  "id": "qr_123456"
}
```

> **使用流程**: 创建订单 → 获取二维码 → 展示给用户扫码 → 轮询订单状态 → 支付成功

### 查询订单 `GET /api/order-status?orderId=xxx`

**响应**:
```json
{
  "orderId": "ORD1757825452250764",
  "status": "success",
  "amount": 10.00,
  "paidAt": "2025-01-13 19:26:15"
}
```

状态: `pending`(待支付) / `success`(成功) / `failed`(失败) / `expired`(过期)

---

## 回调通知

支付成功后，系统会POST通知到商户配置的回调URL。

### 回调数据

```json
{
  "orderId": "ORD1757825452250764",
  "amount": 10.00,
  "paymentMethod": "alipay",
  "status": "success",
  "timestamp": 1736851575,
  "merchantId": "cm1234567890",
  "nonce": "f8e3d2c1b0a9",
  "signature": "8d7e9f2a..."
}
```

### 请求头
| Header | 说明 |
|--------|------|
| X-Merchant-Id | 商户ID |
| X-Payment-System | `AlipayWechatGateway/1.0` |

### 商户响应

返回HTTP 200和JSON表示成功：
```json
{ "success": true }
```

---

## 签名验证

使用HMAC-SHA256算法验证回调数据的真实性。

### 验证步骤

1. 从回调数据中提取 `signature`，其余参数用于验证
2. 添加 `api_key` 参数（值为您的API密钥）
3. 按key字典序排序，拼接成 `key1=value1&key2=value2` 格式
4. 使用HMAC-SHA256计算签名，与收到的signature比对

### Node.js 示例

```javascript
const crypto = require('crypto');

const API_KEY = 'your-api-key';

// 验证签名
function verifySignature(data, apiKey) {
  const { signature, ...params } = data;

  // 添加api_key并排序
  const allParams = { ...params, api_key: apiKey };
  const signString = Object.keys(allParams)
    .sort()
    .filter(k => allParams[k] != null)
    .map(k => `${k}=${allParams[k]}`)
    .join('&');

  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// 回调处理
app.post('/payment-callback', (req, res) => {
  const data = req.body;

  // 1. 验证签名
  if (!verifySignature(data, API_KEY)) {
    return res.status(401).json({ success: false, error: '签名错误' });
  }

  // 2. 验证时间戳（5分钟有效期）
  if (Math.abs(Date.now()/1000 - data.timestamp) > 300) {
    return res.status(401).json({ success: false, error: '请求过期' });
  }

  // 3. 处理业务逻辑
  console.log('支付成功:', data.orderId, data.amount);

  res.json({ success: true });
});
```

### PHP 示例

```php
<?php
$API_KEY = 'your-api-key';

function verifySignature($data, $apiKey) {
    $signature = $data['signature'];
    unset($data['signature']);

    $data['api_key'] = $apiKey;
    ksort($data);

    $signString = http_build_query($data);
    $expected = hash_hmac('sha256', $signString, $apiKey);

    return hash_equals($signature, $expected);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!verifySignature($data, $API_KEY)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => '签名错误']);
    exit;
}

// 处理业务逻辑
error_log("支付成功: {$data['orderId']}");

echo json_encode(['success' => true]);
?>
```

### Python 示例

```python
import hmac, hashlib, time
from flask import Flask, request, jsonify

API_KEY = 'your-api-key'
app = Flask(__name__)

def verify_signature(data, api_key):
    signature = data.pop('signature', '')
    data['api_key'] = api_key

    sign_string = '&'.join(f"{k}={v}" for k, v in sorted(data.items()) if v is not None)
    expected = hmac.new(api_key.encode(), sign_string.encode(), hashlib.sha256).hexdigest()

    return hmac.compare_digest(signature, expected)

@app.route('/payment-callback', methods=['POST'])
def callback():
    data = request.get_json()

    if not verify_signature(data.copy(), API_KEY):
        return jsonify({'success': False, 'error': '签名错误'}), 401

    print(f"支付成功: {data['orderId']}")
    return jsonify({'success': True})
```

---

## 测试

### 创建测试订单
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productName":"测试商品","amount":0.01,"paymentMethod":"alipay"}'
```

### 查询订单状态
```bash
curl "http://localhost:3000/api/order-status?orderId=ORD1757825452250764"
```

---

## 注意事项

1. **幂等性**: 同一订单可能收到多次回调，需根据orderId去重
2. **超时**: 回调处理应在5秒内完成，否则会触发重试
3. **HTTPS**: 生产环境回调URL必须使用HTTPS
4. **时间戳**: 回调有效期5分钟，超时应拒绝处理
5. **商户ID**: 多商户场景下需验证 `merchantId` 是否与预期一致
