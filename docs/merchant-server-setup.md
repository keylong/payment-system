# 商户回调服务器设置指南

## 快速启动

### 1. 启动商户回调服务器
```bash
# 在新的终端窗口中运行
cd /Users/keylongjasper/Documents/收款/payment-system
node tools/merchant-server.js
```

### 2. 启动支付系统
```bash
# 在另一个终端窗口中运行
cd /Users/keylongjasper/Documents/收款/payment-system
npm run dev
```

## 服务器信息

- **端口**: 3001
- **回调地址**: `http://localhost:3001/callback`
- **健康检查**: `http://localhost:3001/health`
- **API密钥**: `34073969`

## 测试流程

### 1. 发送测试支付通知
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "key: 34073969" \
  -d '{"message":"收到转账0.01元(微信支付)"}'
```

### 2. 查看回调日志
商户服务器会显示详细的回调处理日志：
```
=== 收到支付回调通知 ===
订单ID: PAY17578167384010581
支付金额: 0.01
用户ID/订单号: 99910589
支付方式: 微信
支付状态: success
客户类型: 未知
时间戳: 2025-9-13 19:25:38
========================
```

## 服务器特性

### 🔐 安全验证
- HMAC-SHA256签名验证
- 时间戳防重放攻击
- 参数完整性检查

### 📋 日志记录
- 详细的回调信息记录
- 签名验证过程日志
- 错误处理和异常捕获

### 🔄 业务处理
- 自动解析支付信息
- 可扩展的业务逻辑处理
- 标准化响应格式

## API端点

### POST /callback
接收支付回调通知

**请求格式**:
```json
{
  "orderId": "PAY17578167384010581",
  "amount": 0.01,
  "uid": "99910589",
  "paymentMethod": "wechat",
  "status": "success",
  "timestamp": 1757816738,
  "nonce": "00c2e55ba0034bd0",
  "signature": "abc123def456..."
}
```

**响应格式**:
```json
{
  "success": true,
  "message": "回调处理成功",
  "orderId": "PAY17578167384010581"
}
```

### GET /health
健康检查端点

**响应格式**:
```json
{
  "status": "ok",
  "service": "merchant-callback-server",
  "port": 3001,
  "time": "2025-09-13T19:25:38.000Z"
}
```

## 故障排除

### 回调失败 404 Not Found
- 确保商户服务器已启动
- 检查端口3001是否被占用
- 验证回调URL配置是否正确

### 签名验证失败
- 检查API密钥是否匹配
- 确认时间戳在有效期内（5分钟）
- 验证签名计算逻辑是否正确

### 参数错误
- 检查JSON格式是否正确
- 确认必要参数是否完整
- 验证参数值类型是否正确

## 生产环境部署

### 配置建议
1. **使用进程管理器**: PM2, Forever等
2. **配置反向代理**: Nginx, Apache等  
3. **HTTPS**: 生产环境必须使用HTTPS
4. **日志管理**: 配置日志轮转和存储
5. **监控告警**: 设置服务状态监控

### 安全建议
1. **API密钥管理**: 使用环境变量存储
2. **IP白名单**: 限制回调来源IP
3. **请求限流**: 防止恶意请求
4. **数据验证**: 严格验证所有输入参数