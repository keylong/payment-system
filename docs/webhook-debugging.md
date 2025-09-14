# Webhook 401错误调试指南

## 快速调试步骤

### 1. 启动开发服务器
```bash
cd /path/to/payment-system
npm run dev
```

### 2. 查看实时日志
启动服务器后，所有webhook请求都会在控制台显示详细日志。

### 3. 使用测试工具

#### 发送有效请求测试
```bash
node tools/test-webhook.js valid
```

#### 测试API密钥错误
```bash
node tools/test-webhook.js invalid-key
```

#### 测试缺少API密钥
```bash
node tools/test-webhook.js missing-key
```

#### 测试签名错误
```bash
node tools/test-webhook.js invalid-signature
```

#### 测试缺少签名
```bash
node tools/test-webhook.js missing-signature
```

### 4. 通过API查看webhook日志
```bash
# 查看最近20条日志
curl http://localhost:3000/api/webhook-logs

# 查看最近50条日志
curl http://localhost:3000/api/webhook-logs?count=50

# 清除日志
curl -X POST http://localhost:3000/api/webhook-logs -H "Content-Type: application/json" -d '{"action":"clear"}'
```

## 常见401错误及解决方案

### 错误1：缺少API密钥
**错误信息**: `请求头中缺少x-api-key`
**解决方案**: 确保请求头包含 `X-Api-Key` 字段

**正确的请求示例**:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: secure-webhook-api-key-2024-development-only" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: your-signature-hash" \
  -d '{"message":"收到转账500.00元(微信支付)"}'
```

### 错误2：API密钥不匹配
**错误信息**: `API密钥无效或不匹配`
**解决方案**: 检查API密钥是否与环境变量中的密钥一致

**检查当前配置的API密钥**:
```bash
# 查看.env.local文件
cat .env.local | grep WEBHOOK_API_KEY
```

### 错误3：缺少签名
**错误信息**: `请求头中缺少x-signature签名`
**解决方案**: 确保请求头包含 `X-Signature` 字段

### 错误4：签名验证失败
**错误信息**: `签名验证失败，请检查签名计算方式`
**解决方案**: 检查签名计算是否正确

**正确的签名计算方式**:
```javascript
const crypto = require('crypto');

function generateSignature(payload, apiKey, timestamp) {
  const signString = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');
}
```

### 错误5：时间戳过期
**错误信息**: `请求时间戳过期`
**解决方案**: 确保时间戳在5分钟内

## 日志分析

### 控制台日志格式
```
=== WEBHOOK详细日志 ===
时间: 2025-09-13T10:30:45.123Z
阶段: 请求开始
方法: POST
URL: http://localhost:3000/webhook
客户端IP: 127.0.0.1
User-Agent: Node.js HTTP Client
Content-Length: 45 bytes

--- 请求头 ---
content-type: application/json
x-api-key: secu****only
x-timestamp: 1726225845
x-signature: abc1****5678

--- 请求体 ---
{"message":"收到转账500.00元(微信支付)"}

--- 签名信息 ---
签名: abc123def456789...

✅ 阶段通过: 请求开始
======================
```

### 日志阶段说明
1. **请求开始**: 记录基本请求信息
2. **限流检查**: 验证请求频率
3. **请求格式验证**: 检查请求体格式
4. **可疑内容检测**: 检测潜在的恶意内容
5. **开始安全验证**: 准备进行API密钥和签名验证
6. **API密钥和签名验证**: 核心安全验证
7. **请求处理完成**: 成功处理请求

### 错误日志示例
```
=== WEBHOOK详细日志 ===
时间: 2025-09-13T10:30:45.123Z
阶段: 安全检查: API密钥和签名验证
...
--- 错误信息 ---
❌ API密钥和签名验证失败: INVALID_API_KEY: API密钥无效或不匹配
======================
```

## 手动调试步骤

### 1. 检查环境配置
```bash
# 确认API密钥配置
echo "当前API密钥: $(grep WEBHOOK_API_KEY .env.local)"
```

### 2. 验证服务器状态
```bash
# 检查服务器是否运行
curl http://localhost:3000/webhook
```

### 3. 测试基本连接
```bash
# 发送GET请求检查端点状态
curl -X GET http://localhost:3000/webhook
```

### 4. 逐步增加验证
```bash
# 1. 只发送API密钥
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: secure-webhook-api-key-2024-development-only" \
  -d '{"message":"test"}'

# 2. 添加时间戳
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: secure-webhook-api-key-2024-development-only" \
  -H "X-Timestamp: $(date +%s)" \
  -d '{"message":"test"}'

# 3. 使用测试工具生成完整请求
node tools/test-webhook.js valid
```

## 生产环境调试

### 启用详细日志
在生产环境中，可以通过环境变量控制日志详细程度：

```bash
export WEBHOOK_DEBUG=true
npm start
```

### 监控关键指标
- 401错误率
- 签名验证失败率
- API密钥错误率
- 请求响应时间

### 安全建议
1. 不要在生产日志中输出完整的API密钥
2. 定期轮换API密钥
3. 监控异常请求模式
4. 设置告警机制

## 联系支持

如果问题仍然存在，请提供以下信息：
1. 完整的错误日志
2. 请求的curl命令
3. 环境配置信息（隐藏敏感信息）
4. 客户端代码示例