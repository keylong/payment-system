# 智能支付网关商户接入完整指南

## 📋 目录
- [快速开始](#快速开始)
- [系统架构](#系统架构)
- [接入准备](#接入准备)
- [API接口文档](#API接口文档)
- [回调通知](#回调通知)
- [签名机制](#签名机制)
- [示例代码](#示例代码)
- [测试指南](#测试指南)
- [生产部署](#生产部署)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 1. 系统概述
本智能支付网关是基于微信/支付宝个人收款码的聚合支付解决方案，具备以下特性：

- **🎯 智能订单匹配**: 通过金额+时间窗口智能匹配订单，避免重复金额冲突
- **⚡ 实时回调通知**: 支付成功后立即回调商户系统，支持重试机制
- **🔐 安全签名验证**: HMAC-SHA256签名算法，确保数据传输安全
- **📱 多端适配**: 支持PC端和移动端管理界面
- **📊 完整数据统计**: 支付统计、订单管理、导出功能
- **🕒 上海时区**: 全系统使用上海时间，符合国内使用习惯

### 2. 接入流程概览
```
商户系统 → 创建订单 → 用户扫码支付 → 智能匹配 → 回调通知 → 业务处理完成
```

### 3. 技术要求
- **后端环境**: Node.js 18+、PHP 7.4+、Java 8+、Python 3.8+ 或其他支持HMAC-SHA256的环境
- **网络协议**: HTTPS（生产环境必需）
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 🏗️ 系统架构

### 核心组件架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   商户系统      │    │   支付网关      │    │   监控收款      │
│                 │    │                 │    │                 │
│ • 订单管理      │◄──►│ • 订单创建      │◄──►│ • 支付监听      │
│ • 回调处理      │    │ • 智能匹配      │    │ • 消息解析      │
│ • 业务逻辑      │    │ • 回调通知      │    │ • 实时上报      │
│ • 签名验证      │    │ • 重试机制      │    │ • 状态同步      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 数据流转时序
```
用户下单 → 创建订单 → 生成支付信息 → 用户扫码支付 → 
系统监听 → 智能匹配 → 状态更新 → 回调通知 → 商户处理 → 完成交易
```

### 智能匹配机制
1. **精确匹配**: 优先匹配金额完全相符的订单
2. **时间窗口**: 15分钟内的订单参与匹配
3. **防冲突**: 重复金额自动调整（加减分处理）
4. **置信度**: 根据匹配条件计算匹配置信度
5. **手动确认**: 低置信度订单支持后台手动确认

---

## 🔧 接入准备

### 1. 获取接入凭证
访问系统管理界面，在配置页面设置：

- **API密钥**: 用于签名验证的密钥字符串
- **回调地址**: 接收支付通知的完整URL地址
- **商户信息**: 商户名称、描述等基本信息（可选）

### 2. 配置回调服务器
确保您的回调服务器满足以下要求：

- ✅ **协议**: 支持HTTPS协议（生产环境强制要求）
- ✅ **方法**: 能够处理HTTP POST请求
- ✅ **响应时间**: 处理时间 < 5秒（建议 < 2秒）
- ✅ **状态码**: 返回标准HTTP状态码（200表示成功）
- ✅ **幂等性**: 支持重复请求处理
- ✅ **日志记录**: 记录请求和处理日志

### 3. 网络和安全要求
- **域名解析**: 确保回调域名可正常解析
- **防火墙**: 允许支付网关IP访问
- **SSL证书**: 生产环境必须配置有效的SSL证书
- **API密钥**: 妥善保管，定期更新

---

## 📡 API接口文档

### 基础信息
- **环境地址**: `https://your-payment-gateway.com`
- **API版本**: v1.0
- **请求方式**: HTTP POST/GET
- **数据格式**: JSON
- **字符编码**: UTF-8
- **Content-Type**: `application/json`

### 1. 创建订单 `POST /api/orders`

创建新的支付订单，返回订单信息和支付详情。

**请求格式**:
```json
{
  "productName": "商品名称",
  "amount": 0.01,
  "paymentMethod": "alipay"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| productName | string | 是 | 商品名称，最大50字符 |
| amount | number | 是 | 订单金额，最小0.01，最大10000 |
| paymentMethod | string | 是 | 支付方式：`alipay`/`wechat` |

**响应格式**:
```json
{
  "success": true,
  "orderId": "ORD1757825452250764",
  "amount": 0.01,
  "displayAmount": 0.01,
  "paymentMethod": "alipay",
  "message": "订单创建成功！",
  "expiresAt": "2025-01-13 19:40:38"
}
```

**响应说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 创建结果 |
| orderId | string | 订单唯一标识 |
| amount | number | 实际支付金额（可能因防重复调整） |
| displayAmount | number | 原始订单金额 |
| paymentMethod | string | 支付方式 |
| message | string | 结果说明 |
| expiresAt | string | 订单过期时间（上海时间） |

### 2. 查询订单状态 `GET /api/order-status`

查询指定订单的当前状态和详细信息。

**请求参数**:
```
GET /api/order-status?orderId=ORD1757825452250764
```

**响应格式**:
```json
{
  "orderId": "ORD1757825452250764",
  "productName": "测试商品",
  "amount": 0.01,
  "paymentMethod": "alipay",
  "status": "success",
  "paymentId": "PAY1757825513331",
  "createdAt": "2025-01-13 19:25:38",
  "expiresAt": "2025-01-13 19:40:38",
  "paidAt": "2025-01-13 19:26:15"
}
```

**状态说明**:
| 状态 | 说明 |
|------|------|
| pending | 等待支付 |
| success | 支付成功 |
| failed | 支付失败 |
| expired | 订单过期 |

### 3. 商户配置管理 `POST /api/config`

配置商户基本信息和回调参数。

**请求格式**:
```json
{
  "callbackUrl": "https://your-merchant.com/payment-callback",
  "apiKey": "your-secret-api-key",
  "name": "商户名称",
  "description": "商户描述"
}
```

**响应格式**:
```json
{
  "success": true,
  "message": "配置更新成功"
}
```

### 4. 查询支付记录 `GET /api/payments`

查询支付记录列表，支持分页。

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "PAY1757825513331",
      "amount": 0.01,
      "uid": "ORD1757825452250764",
      "paymentMethod": "alipay",
      "status": "success",
      "timestamp": "2025-01-13 19:26:15",
      "callbackStatus": "sent"
    }
  ],
  "total": 1
}
```

---

## 🔔 回调通知机制

### 通知触发时机
- ✅ 订单支付成功时
- ✅ 智能匹配完成时
- ✅ 系统检测到匹配的收款时
- ⚠️ 不在订单失败或过期时触发

### 通知方式和重试策略
- **协议**: HTTP POST请求
- **格式**: JSON数据
- **重试**: 失败后自动重试，间隔递增
- **超时**: 单次请求5秒超时
- **状态**: 记录回调状态（pending/sent/failed）

### 回调数据格式
```json
{
  "orderId": "ORD1757825452250764",
  "amount": 0.01,
  "uid": "ORD1757825452250764",
  "paymentMethod": "alipay",
  "status": "success",
  "timestamp": "2025-01-13 19:26:15",
  "customerType": "新客户",
  "nonce": "f8e3d2c1b0a9",
  "signature": "8d7e9f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e"
}
```

### 回调字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| orderId | string | 订单号 |
| amount | number | 支付金额 |
| uid | string | 用户标识/订单标识 |
| paymentMethod | string | 支付方式 |
| status | string | 支付状态（通常为success） |
| timestamp | string | 支付时间（上海时间） |
| customerType | string | 客户类型（新客户/老顾客/null） |
| nonce | string | 随机数，防重放 |
| signature | string | HMAC-SHA256签名 |

### 商户响应要求
**成功响应**:
```json
{
  "success": true,
  "message": "处理成功"
}
```

**失败响应** (会触发重试):
```json
{
  "success": false,
  "error": "处理失败原因"
}
```

---

## 🔐 签名机制详解

### 签名算法
采用HMAC-SHA256算法，确保数据传输的完整性和真实性。

### 签名生成步骤
1. **收集参数**: 获取除signature外的所有参数
2. **参数排序**: 按参数名字典序升序排列
3. **添加密钥**: 在参数中添加`api_key`字段
4. **构建字符串**: 按`key1=value1&key2=value2`格式拼接
5. **计算签名**: 使用HMAC-SHA256算法生成签名
6. **十六进制**: 转换为小写十六进制字符串

### 签名验证示例

**原始参数**:
```json
{
  "orderId": "ORD1757825452250764",
  "amount": 0.01,
  "status": "success",
  "timestamp": "2025-01-13 19:26:15",
  "nonce": "f8e3d2c1b0a9"
}
```

**构建签名字符串**:
```
amount=0.01&api_key=your_secret_key&nonce=f8e3d2c1b0a9&orderId=ORD1757825452250764&status=success&timestamp=2025-01-13 19:26:15
```

**计算签名**:
```
signature = HMAC-SHA256(签名字符串, API密钥)
```

### 时间戳验证
- **有效期**: 5分钟（300秒）
- **时区**: 统一使用UTC时间戳
- **防重放**: 结合nonce防止重放攻击

---

## 💻 示例代码

### Node.js + Express 完整示例
```javascript
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const API_KEY = 'your-secret-api-key';
const GATEWAY_URL = 'https://your-payment-gateway.com';

// 签名生成函数
function generateSignature(params, apiKey) {
  // 添加API密钥到参数中
  const allParams = { ...params, api_key: apiKey };
  
  // 按key排序
  const sortedKeys = Object.keys(allParams).sort();
  
  // 构建签名字符串
  const signString = sortedKeys
    .filter(key => allParams[key] !== undefined && allParams[key] !== null)
    .map(key => `${key}=${allParams[key]}`)
    .join('&');
  
  console.log('签名字符串:', signString);
  
  // 生成HMAC-SHA256签名
  return crypto.createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');
}

// 签名验证函数
function verifySignature(params, receivedSignature, apiKey) {
  try {
    const { signature, ...otherParams } = params;
    const expectedSignature = generateSignature(otherParams, apiKey);
    
    // 使用constant-time比较防止时序攻击
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('签名验证错误:', error);
    return false;
  }
}

// 创建订单
app.post('/create-order', async (req, res) => {
  try {
    const { productName, amount, paymentMethod } = req.body;
    
    const response = await axios.post(`${GATEWAY_URL}/api/orders`, {
      productName,
      amount,
      paymentMethod
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('创建订单失败:', error.response?.data || error.message);
    res.status(500).json({ error: '创建订单失败' });
  }
});

// 查询订单状态
app.get('/order-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const response = await axios.get(`${GATEWAY_URL}/api/order-status?orderId=${orderId}`);
    
    res.json(response.data);
  } catch (error) {
    console.error('查询订单失败:', error.response?.data || error.message);
    res.status(500).json({ error: '查询订单失败' });
  }
});

// 支付回调处理
app.post('/payment-callback', (req, res) => {
  try {
    console.log('收到支付回调:', req.body);
    
    const { signature, ...params } = req.body;
    
    // 1. 验证签名
    if (!verifySignature(req.body, signature, API_KEY)) {
      console.error('签名验证失败');
      return res.status(401).json({ 
        success: false, 
        error: '签名验证失败' 
      });
    }
    
    // 2. 验证时间戳（可选，如果有timestamp字段）
    if (params.timestamp) {
      const now = new Date();
      const callbackTime = new Date(params.timestamp);
      const timeDiff = Math.abs(now - callbackTime) / 1000;
      
      if (timeDiff > 300) { // 5分钟
        console.error('回调时间戳过期');
        return res.status(401).json({ 
          success: false, 
          error: '回调已过期' 
        });
      }
    }
    
    // 3. 检查订单是否已处理（幂等性）
    if (isOrderAlreadyProcessed(params.orderId)) {
      console.log(`订单 ${params.orderId} 已处理过，直接返回成功`);
      return res.json({ 
        success: true, 
        message: '订单已处理' 
      });
    }
    
    // 4. 处理业务逻辑
    if (params.status === 'success') {
      // 支付成功处理
      console.log(`订单支付成功: ${params.orderId}, 金额: ${params.amount}`);
      
      // 更新订单状态
      updateOrderStatus(params.orderId, 'paid', params.amount);
      
      // 发送确认邮件
      sendConfirmationEmail(params.orderId, params.amount);
      
      // 触发发货流程
      triggerShipment(params.orderId);
      
      // 记录支付日志
      logPaymentSuccess(params);
    }
    
    // 5. 返回成功响应
    res.json({
      success: true,
      message: '回调处理成功',
      orderId: params.orderId
    });
    
  } catch (error) {
    console.error('回调处理异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '内部处理错误' 
    });
  }
});

// 业务逻辑函数
function isOrderAlreadyProcessed(orderId) {
  // 检查数据库中订单是否已处理
  // 这里应该查询您的数据库
  return false; // 示例返回
}

function updateOrderStatus(orderId, status, amount) {
  // 更新数据库中的订单状态
  console.log(`更新订单状态: ${orderId} -> ${status}`);
}

function sendConfirmationEmail(orderId, amount) {
  // 发送支付确认邮件
  console.log(`发送确认邮件: 订单${orderId}, 金额${amount}`);
}

function triggerShipment(orderId) {
  // 触发发货流程
  console.log(`触发发货: 订单${orderId}`);
}

function logPaymentSuccess(params) {
  // 记录支付成功日志
  console.log('支付成功日志:', params);
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'merchant-server',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`商户服务器启动成功，端口: ${PORT}`);
});
```

### PHP 示例代码
```php
<?php
class PaymentHandler {
    private $apiKey;
    
    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }
    
    // 生成签名
    public function generateSignature($params) {
        $params['api_key'] = $this->apiKey;
        ksort($params);
        
        $signString = '';
        foreach ($params as $key => $value) {
            if ($value !== null && $value !== '') {
                $signString .= $key . '=' . $value . '&';
            }
        }
        $signString = rtrim($signString, '&');
        
        return hash_hmac('sha256', $signString, $this->apiKey);
    }
    
    // 验证签名
    public function verifySignature($params, $signature) {
        $receivedParams = $params;
        unset($receivedParams['signature']);
        
        $expectedSignature = $this->generateSignature($receivedParams);
        
        return hash_equals($signature, $expectedSignature);
    }
    
    // 处理支付回调
    public function handleCallback() {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (!$data) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => '数据格式错误']);
            return;
        }
        
        // 验证签名
        if (!$this->verifySignature($data, $data['signature'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => '签名验证失败']);
            return;
        }
        
        // 验证时间戳
        if (isset($data['timestamp'])) {
            $callbackTime = strtotime($data['timestamp']);
            $currentTime = time();
            
            if (abs($currentTime - $callbackTime) > 300) {
                http_response_code(401);
                echo json_encode(['success' => false, 'error' => '回调已过期']);
                return;
            }
        }
        
        // 处理业务逻辑
        if ($data['status'] === 'success') {
            $this->processPaymentSuccess($data);
        }
        
        // 返回成功响应
        echo json_encode([
            'success' => true,
            'message' => '处理成功',
            'orderId' => $data['orderId']
        ]);
    }
    
    private function processPaymentSuccess($data) {
        // 支付成功处理逻辑
        error_log("订单支付成功: " . $data['orderId'] . ", 金额: " . $data['amount']);
        
        // 更新数据库
        // 发送邮件
        // 其他业务逻辑
    }
}

// 使用示例
$handler = new PaymentHandler('your-secret-api-key');
$handler->handleCallback();
?>
```

### Python Flask 示例
```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import time
from datetime import datetime

app = Flask(__name__)
API_KEY = 'your-secret-api-key'

def generate_signature(params, api_key):
    """生成签名"""
    params_copy = params.copy()
    params_copy['api_key'] = api_key
    
    # 按key排序
    sorted_params = sorted(params_copy.items())
    
    # 构建签名字符串
    sign_string = '&'.join([f"{k}={v}" for k, v in sorted_params if v is not None])
    
    # 生成HMAC-SHA256签名
    signature = hmac.new(
        api_key.encode('utf-8'),
        sign_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return signature

def verify_signature(params, received_signature, api_key):
    """验证签名"""
    params_copy = params.copy()
    if 'signature' in params_copy:
        del params_copy['signature']
    
    expected_signature = generate_signature(params_copy, api_key)
    
    return hmac.compare_digest(received_signature, expected_signature)

@app.route('/payment-callback', methods=['POST'])
def payment_callback():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': '数据格式错误'}), 400
        
        print(f"收到支付回调: {data}")
        
        # 验证签名
        signature = data.get('signature')
        if not signature or not verify_signature(data, signature, API_KEY):
            return jsonify({'success': False, 'error': '签名验证失败'}), 401
        
        # 验证时间戳
        if 'timestamp' in data:
            callback_time = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
            current_time = datetime.now()
            time_diff = abs((current_time - callback_time).total_seconds())
            
            if time_diff > 300:  # 5分钟
                return jsonify({'success': False, 'error': '回调已过期'}), 401
        
        # 处理业务逻辑
        if data.get('status') == 'success':
            process_payment_success(data)
        
        return jsonify({
            'success': True,
            'message': '处理成功',
            'orderId': data.get('orderId')
        })
        
    except Exception as e:
        print(f"回调处理异常: {e}")
        return jsonify({'success': False, 'error': '内部处理错误'}), 500

def process_payment_success(data):
    """处理支付成功"""
    print(f"订单支付成功: {data['orderId']}, 金额: {data['amount']}")
    
    # 更新订单状态
    # 发送确认邮件
    # 触发发货流程
    # 记录日志等

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'merchant-server',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=False)
```

---

## 🧪 测试指南

### 1. 本地测试环境
```bash
# 启动支付网关
cd /path/to/payment-system
npm run dev  # 默认端口3000

# 启动测试商户服务器
node tools/merchant-server.js  # 端口3001
```

### 2. 配置测试参数
访问管理界面 `http://localhost:3000`，在配置页面设置：
- **API密钥**: `test_key_123456`
- **回调地址**: `http://localhost:3001/payment-callback`

### 3. API测试步骤

#### 3.1 创建测试订单
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "测试商品",
    "amount": 0.01,
    "paymentMethod": "alipay"
  }'
```

**期望响应**:
```json
{
  "success": true,
  "orderId": "ORD1757825452250764",
  "amount": 0.01,
  "message": "订单创建成功！"
}
```

#### 3.2 模拟支付通知
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "key: test_key_123456" \
  -d '{
    "message": "收到转账0.01元(支付宝)"
  }'
```

#### 3.3 查询订单状态
```bash
curl "http://localhost:3000/api/order-status?orderId=ORD1757825452250764"
```

### 4. 回调测试验证
检查商户服务器控制台输出：
```
收到支付回调: {
  orderId: 'ORD1757825452250764',
  amount: 0.01,
  status: 'success',
  ...
}
回调处理成功
```

### 5. 压力测试
```bash
# 使用ab工具进行压力测试
ab -n 100 -c 10 -H "Content-Type: application/json" \
   -p order.json http://localhost:3000/api/orders

# order.json内容
{
  "productName": "压力测试商品",
  "amount": 0.01,
  "paymentMethod": "alipay"
}
```

---

## 🚀 生产部署

### 1. 服务器配置要求
- **CPU**: 4核心及以上（推荐8核心）
- **内存**: 8GB及以上（推荐16GB）
- **硬盘**: SSD 100GB及以上
- **网络**: 10Mbps及以上带宽
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### 2. 域名和SSL证书
```bash
# 安装Certbot（Ubuntu/Debian）
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 申请SSL证书
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# 设置自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Nginx配置
```nginx
# /etc/nginx/sites-available/payment-gateway
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 日志配置
    access_log /var/log/nginx/payment-gateway.access.log;
    error_log /var/log/nginx/payment-gateway.error.log;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API接口限流
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        # ... 其他proxy配置
    }
}

# HTTP跳转HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# 限流配置
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

### 4. PM2进程管理
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'payment-gateway',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机启动
pm2 startup
pm2 save
```

### 5. 数据库优化
```sql
-- PostgreSQL索引优化
CREATE INDEX CONCURRENTLY idx_orders_status ON demo_orders(status);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON demo_orders(created_at);
CREATE INDEX CONCURRENTLY idx_payments_timestamp ON payments(timestamp);
CREATE INDEX CONCURRENTLY idx_payments_uid ON payments(uid);

-- 连接池配置（在数据库配置中）
{
  "max": 20,
  "min": 2,
  "idle": 10000
}
```

### 6. 监控和日志
```bash
# 安装日志管理工具
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# 设置监控（可选）
pm2 monitor
```

### 7. 安全加固
```bash
# 防火墙配置
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 禁用不必要的服务
sudo systemctl disable apache2  # 如果有的话
sudo systemctl disable mysql    # 如果使用外部数据库

# 设置定期安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### 8. 备份策略
```bash
#!/bin/bash
# 数据库备份脚本
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/payment-system"
DB_NAME="payment_system"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 数据库备份
pg_dump $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# 应用文件备份
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /path/to/payment-system

# 清理7天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

# 添加到crontab
# 0 2 * * * /path/to/backup.sh
```

---

## ❓ 常见问题解答

### Q1: 回调通知失败，如何排查？
**A**: 按以下步骤排查：

1. **检查回调URL**
   ```bash
   curl -X POST https://your-domain.com/payment-callback \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

2. **查看错误日志**
   - 支付网关日志：`/var/log/nginx/payment-gateway.error.log`
   - 应用日志：`pm2 logs payment-gateway`
   - 商户服务器日志

3. **验证SSL证书**
   ```bash
   openssl s_client -connect your-domain.com:443
   ```

4. **检查防火墙规则**
   ```bash
   sudo ufw status
   netstat -tlnp | grep :443
   ```

### Q2: 签名验证总是失败？
**A**: 检查以下几点：

1. **API密钥是否正确**
   - 确认配置页面的API密钥与代码中一致
   - 注意密钥中的特殊字符

2. **参数排序问题**
   ```javascript
   // 正确的排序方式
   const sortedKeys = Object.keys(params).sort();
   
   // 错误示例：未排序
   const keys = Object.keys(params);
   ```

3. **编码问题**
   ```javascript
   // 确保使用UTF-8编码
   const signature = crypto
     .createHmac('sha256', apiKey)
     .update(signString, 'utf8')
     .digest('hex');
   ```

4. **时间戳格式**
   ```javascript
   // 统一使用上海时间格式
   const timestamp = "2025-01-13 19:26:15"
   ```

### Q3: 订单匹配不准确怎么办？
**A**: 优化匹配策略：

1. **理解匹配机制**
   - 系统优先匹配精确金额
   - 时间窗口为15分钟
   - 重复金额会自动调整

2. **避免重复金额**
   ```javascript
   // 创建订单时使用更精确的金额
   const amount = 1.00 + Math.random() * 0.99; // 1.00-1.99
   ```

3. **手动确认匹配**
   - 访问管理后台的未匹配支付页面
   - 手动确认匹配关系

4. **提高匹配精度**
   - 使用唯一的订单备注信息
   - 控制订单创建频率

### Q4: 如何处理高并发？
**A**: 性能优化策略：

1. **数据库优化**
   ```sql
   -- 添加必要索引
   CREATE INDEX idx_orders_amount_status ON demo_orders(amount, status);
   CREATE INDEX idx_payments_created_at ON payments(created_at);
   ```

2. **应用层缓存**
   ```javascript
   const Redis = require('redis');
   const redis = Redis.createClient();
   
   // 缓存订单状态
   await redis.setex(`order:${orderId}`, 300, JSON.stringify(orderData));
   ```

3. **负载均衡**
   ```nginx
   upstream payment_backend {
       server 127.0.0.1:3000;
       server 127.0.0.1:3001;
       server 127.0.0.1:3002;
   }
   ```

4. **限流配置**
   ```nginx
   limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
   limit_req zone=api burst=200 nodelay;
   ```

### Q5: 数据安全如何保障？
**A**: 安全措施：

1. **传输加密**
   - 强制使用HTTPS
   - TLS 1.2以上版本

2. **数据加密**
   ```javascript
   // 敏感数据加密存储
   const crypto = require('crypto');
   const algorithm = 'aes-256-gcm';
   
   function encrypt(text, key) {
     const iv = crypto.randomBytes(12);
     const cipher = crypto.createCipher(algorithm, key, iv);
     // ...加密逻辑
   }
   ```

3. **访问控制**
   - IP白名单
   - API密钥定期轮换
   - 访问日志记录

4. **数据备份**
   - 每日自动备份
   - 异地备份存储
   - 定期恢复测试

### Q6: 系统监控如何配置？
**A**: 监控方案：

1. **系统监控**
   ```bash
   # 安装监控工具
   sudo apt install htop iotop nethogs
   
   # 系统资源监控
   free -h  # 内存使用
   df -h    # 磁盘使用
   iostat   # IO统计
   ```

2. **应用监控**
   ```javascript
   // 健康检查接口
   app.get('/health', (req, res) => {
     res.json({
       status: 'ok',
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       timestamp: new Date().toISOString()
     });
   });
   ```

3. **日志监控**
   ```bash
   # 实时日志监控
   tail -f /var/log/nginx/payment-gateway.access.log | grep -E "(404|500|502|503)"
   
   # PM2日志监控
   pm2 monit
   ```

4. **告警配置**
   ```bash
   # 简单的告警脚本
   #!/bin/bash
   # 检查服务状态
   if ! curl -f http://localhost:3000/health; then
     # 发送告警
     curl -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
       -d "chat_id=$CHAT_ID&text=支付网关服务异常"
   fi
   ```

### Q7: 如何进行版本升级？
**A**: 升级策略：

1. **准备阶段**
   ```bash
   # 备份当前版本
   cp -r /path/to/payment-system /backup/payment-system-$(date +%Y%m%d)
   
   # 备份数据库
   pg_dump payment_system > /backup/db-$(date +%Y%m%d).sql
   ```

2. **灰度发布**
   ```bash
   # 启动新版本实例
   pm2 start ecosystem.config.js --name payment-gateway-v2
   
   # Nginx配置权重
   upstream payment_backend {
       server 127.0.0.1:3000 weight=3;
       server 127.0.0.1:3001 weight=1;  # 新版本
   }
   ```

3. **监控验证**
   - 检查错误日志
   - 验证关键功能
   - 监控性能指标

4. **完整切换**
   ```bash
   # 停止旧版本
   pm2 stop payment-gateway
   
   # 重命名新版本
   pm2 restart payment-gateway-v2 --name payment-gateway
   ```

---

## 📞 技术支持

### 获取帮助
如果您在接入过程中遇到任何问题，请提供以下信息以便我们快速定位和解决：

1. **错误信息**：完整的错误日志和堆栈信息
2. **请求数据**：请求和响应的完整JSON数据
3. **环境信息**：操作系统、Node.js版本、依赖版本等
4. **复现步骤**：详细的问题复现步骤

### 常用调试命令
```bash
# 检查系统状态
curl http://localhost:3000/health

# 查看应用日志
pm2 logs payment-gateway

# 检查数据库连接
psql -d payment_system -c "SELECT COUNT(*) FROM demo_orders;"

# 测试网络连通性
telnet your-domain.com 443
```

---

## 📋 版本更新记录

### v2.0.0 (2025-01-13)
- 🚀 **重大更新**: 完全重写商户接入文档
- ✨ **新增**: 智能订单匹配系统详细说明
- 🔧 **优化**: 上海时区支持，统一时间显示
- 📱 **改进**: 移动端管理界面完全适配
- 🔐 **增强**: 更完善的签名机制和安全措施
- 📚 **新增**: 多语言示例代码（Node.js、PHP、Python）
- 🧪 **完善**: 详细的测试指南和部署文档

### v1.2.0 (2024-12-20)
- ✨ 新增智能订单匹配功能
- 🔄 优化回调重试机制  
- 📊 支持数据导出功能
- 🔧 修复时区显示问题

### v1.1.0 (2024-11-15)
- 🔐 新增HMAC-SHA256签名验证
- ⚡ 优化数据库查询性能
- 📱 支持移动端界面

### v1.0.0 (2024-10-20)
- 🎉 首个正式版本发布
- 💳 支持支付宝、微信支付
- 📋 基础订单管理功能
- 🔔 回调通知机制

---

## 📄 许可协议

本文档和相关代码遵循 MIT 许可协议。

---

*文档最后更新时间: 2025年1月13日*
*技术支持: 智能支付网关技术团队*