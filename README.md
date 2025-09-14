# 收款系统 - Next.js全栈实现

基于Next.js的收款系统，可接收来自手机支付通知消息，自动解析并回调通知商户。

## 功能特性

- 🔔 **Webhook接收**：接收手机支付通知消息
- 📝 **智能解析**：自动解析支付宝/微信支付消息
- 💾 **数据存储**：本地JSON文件存储支付记录
- 🔄 **自动回调**：支付成功后自动通知商户
- 📊 **管理后台**：实时查看支付记录和统计
- 🔐 **安全验证**：支持API密钥验证

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local` 文件并根据需要修改：

```env
WEBHOOK_API_KEY=webhook-secret-key-123456
MERCHANT_CALLBACK_URL=http://localhost:3001/callback
MERCHANT_API_KEY=test-api-key-123456
```

### 3. 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## API接口

### 1. Webhook接收端点

**POST** `/webhook`

接收支付通知消息：

```json
{
  "message": "com.eg.android.AlipayGphone\n时间\n2025-09-13 22:44:20\n...\n你已成功收款0.02元（老顾客消费）\nUID：10272"
}
```

Headers（可选）：
- `X-API-Key`: API密钥验证

响应：

```json
{
  "success": true,
  "data": {
    "orderId": "PAY1234567890",
    "amount": 0.02,
    "uid": "10272",
    "status": "success"
  }
}
```

### 2. 获取支付记录

**GET** `/api/payments`

返回最近100条支付记录。

### 3. 获取统计数据

**GET** `/api/statistics`

返回支付统计信息。

### 4. 商户配置

**GET/POST** `/api/config`

获取或更新商户回调配置。

### 5. 重试失败回调

**POST** `/api/retry-callbacks`

重试所有失败的回调通知。

## 回调通知

当收到支付通知后，系统会自动向配置的商户URL发送POST请求：

```json
{
  "orderId": "PAY1234567890",
  "amount": 0.02,
  "uid": "10272",
  "paymentMethod": "alipay",
  "status": "success",
  "timestamp": "2025-09-13T22:44:20Z",
  "customerType": "老顾客",
  "signature": "签名字符串"
}
```

Headers：
- `X-Api-Key`: 商户API密钥
- `X-Payment-System`: AlipayWechatGateway/1.0

## 管理后台

访问 http://localhost:3000 查看管理后台，功能包括：

- 📊 实时统计：今日订单、金额等
- 📝 支付记录：查看所有支付记录
- ⚙️ 配置管理：设置回调URL和API密钥
- 🔄 重试机制：重试失败的回调
- 🧪 测试工具：发送测试支付通知

## 消息格式说明

系统支持解析以下格式的支付消息：

### 支付宝格式
```
com.eg.android.AlipayGphone
时间
2025-09-13 22:44:20
来源
com.eg.android.AlipayGphone
已转入余额
你已成功收款0.02元（老顾客消费）
UID：10272
```

### 微信格式
```
com.tencent.mm
时间
2025-09-13 22:44:20
来源
com.tencent.mm
微信支付
收款0.02元
UID：10272
```

## 项目结构

```
payment-system/
├── app/
│   ├── api/
│   │   ├── webhook/         # Webhook接收端点
│   │   ├── payments/        # 支付记录API
│   │   ├── statistics/      # 统计API
│   │   ├── config/          # 配置API
│   │   └── retry-callbacks/ # 重试回调API
│   └── page.tsx             # 管理后台界面
├── lib/
│   ├── parser.ts            # 消息解析器
│   ├── database.ts          # 数据存储
│   └── callback.ts          # 回调处理
└── data/                    # 数据存储目录
    ├── payments.json        # 支付记录
    └── merchants.json       # 商户配置
```

## 安全建议

1. **生产环境**：请修改默认的API密钥
2. **HTTPS**：生产环境建议使用HTTPS
3. **验证签名**：验证回调签名确保数据安全
4. **限流**：建议添加请求限流保护
5. **日志**：记录所有关键操作日志

## 开发说明

- 使用TypeScript确保类型安全
- 遵循SOLID原则设计架构
- 实现DRY原则避免代码重复
- KISS原则保持简单实现

## 许可证

MIT
