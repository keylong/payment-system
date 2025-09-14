#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// 配置
const WEBHOOK_URL = 'http://localhost:3000/webhook';
const API_KEY = 'secure-webhook-api-key-2024-development-only';

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

// 发送测试请求
function sendTestRequest(testType = 'valid') {
  console.log(`\n=== 发送${testType}测试请求 ===`);
  
  let payload, apiKey;
  
  switch (testType) {
    case 'valid':
      payload = { message: '收到转账500.00元(微信支付)' };
      apiKey = API_KEY;
      break;
      
    case 'invalid-key':
      payload = { message: '收到转账500.00元(微信支付)' };
      apiKey = 'wrong-api-key';
      break;
      
    case 'missing-key':
      payload = { message: '收到转账500.00元(微信支付)' };
      apiKey = null;
      break;
      
    case 'invalid-signature':
      payload = { message: '收到转账500.00元(微信支付)' };
      apiKey = API_KEY;
      break;
      
    case 'missing-signature':
      payload = { message: '收到转账500.00元(微信支付)' };
      apiKey = API_KEY;
      break;
  }

  const request = createSecureWebhookRequest(payload, apiKey);
  
  // 模拟不同的错误情况
  if (testType === 'invalid-signature') {
    request.headers['X-Signature'] = 'invalid-signature-hash';
  } else if (testType === 'missing-signature') {
    delete request.headers['X-Signature'];
  } else if (testType === 'missing-key') {
    delete request.headers['X-Api-Key'];
  }

  console.log('请求头:');
  console.log(JSON.stringify(request.headers, null, 2));
  console.log('请求体:', request.body);

  const url = new URL(WEBHOOK_URL);
  const client = url.protocol === 'https:' ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: request.headers
  };

  const req = client.request(options, (res) => {
    console.log(`\n响应状态: ${res.statusCode}`);
    console.log('响应头:', JSON.stringify(res.headers, null, 2));

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('响应体:');
      try {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log(data);
      }
      console.log('=========================\n');
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
  });

  req.write(request.body);
  req.end();
}

// 命令行参数处理
const testType = process.argv[2] || 'valid';
const validTypes = ['valid', 'invalid-key', 'missing-key', 'invalid-signature', 'missing-signature'];

if (!validTypes.includes(testType)) {
  console.log('使用方法: node test-webhook.js [test-type]');
  console.log('可用的测试类型:');
  validTypes.forEach(type => console.log(`  - ${type}`));
  process.exit(1);
}

console.log(`API密钥: ${API_KEY}`);
console.log(`Webhook URL: ${WEBHOOK_URL}`);

if (testType === 'all') {
  // 运行所有测试
  validTypes.slice(0, -1).forEach((type, index) => {
    setTimeout(() => sendTestRequest(type), index * 2000);
  });
} else {
  sendTestRequest(testType);
}