#!/usr/bin/env node

const crypto = require('crypto');
const http = require('http');

// 配置
const CALLBACK_URL = 'http://localhost:3000/api/merchant-callback';
const API_KEY = '34073969';

/**
 * 生成随机字符串（用作nonce）
 */
function generateNonce(length = 16) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * 生成商户端签名
 */
function generateMerchantSignature(params, apiKey, timestamp, nonce) {
  // 合并所有参数
  const allParams = {
    ...params,
    timestamp,
    nonce,
    api_key: apiKey
  };
  
  // 按key字典序排序
  const sortedKeys = Object.keys(allParams).sort();
  
  // 拼接签名字符串
  const signString = sortedKeys
    .map(key => `${key}=${allParams[key]}`)
    .join('&');
  
  console.log('[商户测试] 签名字符串:', signString);
  
  // 生成HMAC-SHA256签名
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');
  
  return signature;
}

/**
 * 为数据添加商户签名
 */
function signMerchantData(data, apiKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  
  const signature = generateMerchantSignature(data, apiKey, timestamp, nonce);
  
  return {
    ...data,
    timestamp,
    nonce,
    signature
  };
}

function sendTestCallback(testType = 'valid') {
  console.log(`\n=== 发送${testType}商户回调测试 ===`);
  
  // 准备测试数据
  let payload = {
    orderId: 'ORDER123456',
    amount: 100.50,
    uid: 'USER001',
    paymentMethod: 'alipay',
    status: 'success'
  };
  
  let apiKey = API_KEY;
  let signedData;
  
  // 根据测试类型修改数据
  switch (testType) {
    case 'valid':
      signedData = signMerchantData(payload, apiKey);
      break;
      
    case 'invalid-signature':
      signedData = signMerchantData(payload, apiKey);
      signedData.signature = 'invalid-signature-hash';
      break;
      
    case 'missing-signature':
      signedData = signMerchantData(payload, apiKey);
      delete signedData.signature;
      break;
      
    case 'expired-timestamp':
      signedData = signMerchantData(payload, apiKey);
      signedData.timestamp = Math.floor(Date.now() / 1000) - 400; // 过期时间戳
      break;
      
    case 'invalid-key':
      signedData = signMerchantData(payload, 'wrong-api-key');
      break;
  }
  
  const body = JSON.stringify(signedData);
  
  console.log('请求数据:');
  console.log(JSON.stringify(signedData, null, 2));

  const url = new URL(CALLBACK_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'MerchantSDK/1.0'
    }
  };

  const req = http.request(options, (res) => {
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

  req.write(body);
  req.end();
}

// 命令行参数处理
const testType = process.argv[2] || 'valid';
const validTypes = ['valid', 'invalid-signature', 'missing-signature', 'expired-timestamp', 'invalid-key'];

if (!validTypes.includes(testType) && testType !== 'all') {
  console.log('使用方法: node test-merchant-crypto.js [test-type]');
  console.log('可用的测试类型:');
  validTypes.forEach(type => console.log(`  - ${type}`));
  console.log('  - all (运行所有测试)');
  process.exit(1);
}

console.log(`商户API密钥: ${API_KEY}`);
console.log(`回调URL: ${CALLBACK_URL}`);

if (testType === 'all') {
  // 运行所有测试
  validTypes.forEach((type, index) => {
    setTimeout(() => sendTestCallback(type), index * 2000);
  });
} else {
  sendTestCallback(testType);
}