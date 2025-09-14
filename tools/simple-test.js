#!/usr/bin/env node

import http from 'http';

// 配置
const WEBHOOK_URL = 'http://localhost:3000/webhook';
const API_KEY = '34073969';

function sendSimpleRequest(testType = 'valid') {
  console.log(`\n=== 发送${testType}测试请求 ===`);
  
  const payload = { message: '收到转账500.00元(微信支付)' };
  const body = JSON.stringify(payload);
  
  // 根据测试类型设置headers
  let headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  };
  
  if (testType === 'valid') {
    headers['key'] = API_KEY;
  } else if (testType === 'invalid-key') {
    headers['key'] = 'wrong-api-key';
  }
  // missing-key 情况下不添加 key
  
  console.log('请求头:');
  console.log(JSON.stringify(headers, null, 2));
  console.log('请求体:', body);

  const url = new URL(WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: 'POST',
    headers: headers
  };

  const req = http.request(options, (res) => {
    console.log(`\n响应状态: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('响应体:');
      try {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
      } catch {
        console.log(data);
      }
      console.log('=========================\n');
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
  });

  req.write(body);
  req.end();
}

// 命令行参数处理
const testType = process.argv[2] || 'valid';
const validTypes = ['valid', 'invalid-key', 'missing-key'];

if (!validTypes.includes(testType)) {
  console.log('使用方法: node simple-test.js [test-type]');
  console.log('可用的测试类型:');
  validTypes.forEach(type => console.log(`  - ${type}`));
  process.exit(1);
}

console.log(`API密钥: ${API_KEY}`);
console.log(`Webhook URL: ${WEBHOOK_URL}`);

sendSimpleRequest(testType);