'use client';

import { useState } from 'react';

export default function MerchantCryptoDemo() {
  const [apiKey, setApiKey] = useState('34073969');
  const [payload, setPayload] = useState(`{
  "orderId": "ORDER123456",
  "amount": 100.50,
  "uid": "USER001",
  "paymentMethod": "alipay",
  "status": "success"
}`);
  const [result, setResult] = useState('');
  const [verifyResult, setVerifyResult] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSignature = async () => {
    setLoading(true);
    try {
      const data = JSON.parse(payload);
      
      // 客户端签名演示（实际应在服务器端进行）
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = Math.random().toString(36).substring(2, 18);
      
      // 构建签名参数
      const signParams = {
        ...data,
        timestamp,
        nonce,
        api_key: apiKey
      };
      
      // 按key排序
      const sortedKeys = Object.keys(signParams).sort();
      const signString = sortedKeys
        .map(key => `${key}=${signParams[key]}`)
        .join('&');
      
      // 模拟HMAC-SHA256签名（实际应使用crypto库）
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(apiKey);
      const dataBuffer = encoder.encode(signString);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const signedData = {
        ...data,
        timestamp,
        nonce,
        signature
      };
      
      setResult(JSON.stringify({
        signString,
        signedData
      }, null, 2));
      
    } catch (error) {
      setResult(`错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    setLoading(false);
  };

  const testCallback = async () => {
    setLoading(true);
    try {
      const resultObj = JSON.parse(result);
      if (!resultObj.signedData) {
        throw new Error('请先生成签名');
      }
      
      const response = await fetch('/api/merchant-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultObj.signedData)
      });
      
      const responseData = await response.json();
      
      setVerifyResult(JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data: responseData
      }, null, 2));
      
    } catch (error) {
      setVerifyResult(`错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center">商户端API加密方式演示</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：参数配置 */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">1. 配置参数</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API密钥
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入API密钥"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  数据载荷 (JSON)
                </label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="输入要签名的JSON数据"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">签名算法说明：</h3>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. 添加时间戳 (timestamp) 和随机数 (nonce)</li>
              <li>2. 添加API密钥参数 (api_key)</li>
              <li>3. 按参数名字典序排序</li>
              <li>4. 拼接成 key1=value1&key2=value2 格式</li>
              <li>5. 使用HMAC-SHA256生成签名</li>
            </ol>
          </div>
        </div>
        
        {/* 右侧：结果显示 */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">2. 生成签名</h2>
            
            <button
              onClick={generateSignature}
              disabled={loading}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 mb-4"
            >
              {loading ? '生成中...' : '生成签名'}
            </button>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                签名结果
              </label>
              <textarea
                value={result}
                readOnly
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-xs"
                placeholder="点击生成签名按钮查看结果"
              />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">3. 验证回调</h2>
            
            <button
              onClick={testCallback}
              disabled={loading || !result}
              className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 mb-4"
            >
              {loading ? '验证中...' : '测试回调验证'}
            </button>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                验证结果
              </label>
              <textarea
                value={verifyResult}
                readOnly
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-xs"
                placeholder="点击测试回调验证按钮查看结果"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 底部：代码示例 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">代码示例</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Node.js 示例</h3>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`const crypto = require('crypto');

function signMerchantData(data, apiKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Math.random().toString(36).substring(2, 18);
  
  const signParams = {
    ...data,
    timestamp,
    nonce,
    api_key: apiKey
  };
  
  const sortedKeys = Object.keys(signParams).sort();
  const signString = sortedKeys
    .map(key => \`\${key}=\${signParams[key]}\`)
    .join('&');
  
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(signString)
    .digest('hex');
  
  return {
    ...data,
    timestamp,
    nonce,
    signature
  };
}`}
            </pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Python 示例</h3>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`import json
import time
import hmac
import hashlib
import random
import string

def sign_merchant_data(data, api_key):
    timestamp = int(time.time())
    nonce = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    sign_params = {
        **data,
        'timestamp': timestamp,
        'nonce': nonce,
        'api_key': api_key
    }
    
    sorted_keys = sorted(sign_params.keys())
    sign_string = '&'.join([f'{k}={sign_params[k]}' for k in sorted_keys])
    
    signature = hmac.new(
        api_key.encode('utf-8'),
        sign_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return {
        **data,
        'timestamp': timestamp,
        'nonce': nonce,
        'signature': signature
    }`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}