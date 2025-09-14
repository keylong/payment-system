#!/usr/bin/env node

import http from 'http';
import crypto from 'crypto';

// 配置
const PORT = 3001;
const API_KEY = '34073969';

/**
 * 验证商户回调签名
 */
function verifyMerchantSignature(params, signature, apiKey, maxAge = 300) {
  try {
    const { timestamp, nonce, ...otherParams } = params;
    
    console.log('[商户验证] 开始验证签名');
    console.log('[商户验证] 收到的参数:', params);
    console.log('[商户验证] 收到的签名:', signature);
    
    // 验证时间戳
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > maxAge) {
      console.log('[商户验证] 时间戳过期，当前时间:', currentTime, '收到时间:', timestamp);
      return false;
    }
    
    // 重新生成签名进行比较
    const allParams = {
      ...otherParams,
      timestamp,
      nonce,
      api_key: apiKey
    };
    
    const sortedKeys = Object.keys(allParams).sort();
    const signString = sortedKeys
      .map(key => `${key}=${allParams[key]}`)
      .join('&');
    
    console.log('[商户验证] 签名字符串:', signString);
    
    const expectedSignature = crypto
      .createHmac('sha256', apiKey)
      .update(signString)
      .digest('hex');
    
    console.log('[商户验证] 期望签名:', expectedSignature);
    console.log('[商户验证] 收到签名:', signature);
    
    // 使用constant-time比较防止时序攻击
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    console.log('[商户验证] 签名验证结果:', isValid);
    return isValid;
    
  } catch (error) {
    console.error('[商户验证] 签名验证异常:', error);
    return false;
  }
}

/**
 * 处理支付回调
 */
function handlePaymentCallback(data) {
  console.log('\n=== 收到支付回调通知 ===');
  console.log('订单ID:', data.orderId);
  console.log('支付金额:', data.amount);
  console.log('用户ID/订单号:', data.uid);
  console.log('支付方式:', data.paymentMethod === 'alipay' ? '支付宝' : '微信');
  console.log('支付状态:', data.status);
  console.log('客户类型:', data.customerType || '未知');
  console.log('时间戳:', new Date(data.timestamp * 1000).toLocaleString('zh-CN'));
  console.log('========================\n');
  
  // 这里可以添加商户的业务逻辑
  // 例如：更新数据库、发送通知、记录日志等
  
  return {
    success: true,
    message: '回调处理成功',
    orderId: data.orderId
  };
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${req.method} ${url.pathname}`);
  
  if (req.method === 'GET') {
    // 健康检查端点
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'merchant-callback-server',
        port: PORT,
        time: new Date().toISOString()
      }));
      return;
    }
    
    // 默认信息页面
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'merchant-callback-server',
      endpoints: {
        '/callback': 'POST - 接收支付回调通知',
        '/health': 'GET - 健康检查'
      },
      status: 'running',
      port: PORT
    }));
    return;
  }
  
  if (req.method === 'POST' && url.pathname === '/callback') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        console.log('[商户服务器] 收到回调请求');
        console.log('[商户服务器] 请求体:', body);
        
        const data = JSON.parse(body);
        const { signature, ...params } = data;
        
        if (!signature) {
          console.log('[商户服务器] 缺少签名');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '缺少签名' }));
          return;
        }
        
        // 验证签名
        const isValid = verifyMerchantSignature(params, signature, API_KEY);
        
        if (!isValid) {
          console.log('[商户服务器] 签名验证失败');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '签名验证失败' }));
          return;
        }
        
        // 处理回调
        const result = handlePaymentCallback(params);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
      } catch (error) {
        console.error('[商户服务器] 处理回调失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: '处理失败',
          message: error.message
        }));
      }
    });
    return;
  }
  
  // 404 未找到
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '端点未找到' }));
});

server.listen(PORT, () => {
  console.log('🚀 商户回调服务器启动成功');
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🔗 回调地址: http://localhost:${PORT}/callback`);
  console.log(`🔑 API密钥: ${API_KEY}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log('\n等待接收支付回调通知...\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n📴 正在关闭商户回调服务器...');
  server.close(() => {
    console.log('✅ 商户回调服务器已关闭');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 未处理的Promise拒绝:', reason);
});