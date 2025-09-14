#!/usr/bin/env python3

import json
import time
import hmac
import hashlib
import requests
import sys

# 配置
WEBHOOK_URL = 'http://localhost:3000/webhook'
API_KEY = 'secure-webhook-api-key-2024-development-only'

def create_secure_webhook_request(payload, api_key):
    """生成安全的webhook请求"""
    timestamp = int(time.time())
    payload_string = json.dumps(payload, separators=(',', ':'))
    sign_string = f"{timestamp}.{payload_string}"
    signature = hmac.new(
        api_key.encode('utf-8'),
        sign_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return {
        'headers': {
            'Content-Type': 'application/json',
            'X-Api-Key': api_key,
            'X-Timestamp': str(timestamp),
            'X-Signature': signature,
            'X-Payment-System': 'AlipayWechatGateway/1.0'
        },
        'data': payload_string
    }

def send_test_request(test_type='valid'):
    """发送测试请求"""
    print(f"\n=== 发送{test_type}测试请求 ===")
    
    # 准备测试数据
    payload = {'message': '收到转账500.00元(微信支付)'}
    api_key = API_KEY
    
    # 根据测试类型修改请求
    if test_type == 'invalid-key':
        api_key = 'wrong-api-key'
    elif test_type == 'missing-key':
        api_key = None
    
    if api_key:
        request_config = create_secure_webhook_request(payload, api_key)
    else:
        request_config = {
            'headers': {
                'Content-Type': 'application/json',
                'X-Payment-System': 'AlipayWechatGateway/1.0'
            },
            'data': json.dumps(payload, separators=(',', ':'))
        }
    
    # 模拟不同的错误情况
    if test_type == 'invalid-signature':
        request_config['headers']['X-Signature'] = 'invalid-signature-hash'
    elif test_type == 'missing-signature':
        if 'X-Signature' in request_config['headers']:
            del request_config['headers']['X-Signature']
    elif test_type == 'missing-key':
        if 'X-Api-Key' in request_config['headers']:
            del request_config['headers']['X-Api-Key']
    
    print('请求头:')
    print(json.dumps(request_config['headers'], indent=2, ensure_ascii=False))
    print(f'请求体: {request_config["data"]}')
    
    try:
        response = requests.post(
            WEBHOOK_URL,
            headers=request_config['headers'],
            data=request_config['data']
        )
        
        print(f'\n响应状态: {response.status_code}')
        print('响应头:')
        print(json.dumps(dict(response.headers), indent=2, ensure_ascii=False))
        
        print('响应体:')
        try:
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        except:
            print(response.text)
        
    except requests.exceptions.RequestException as e:
        print(f'请求错误: {e}')
    
    print('=========================\n')

def main():
    valid_types = ['valid', 'invalid-key', 'missing-key', 'invalid-signature', 'missing-signature']
    
    if len(sys.argv) > 1:
        test_type = sys.argv[1]
    else:
        test_type = 'valid'
    
    if test_type not in valid_types and test_type != 'all':
        print('使用方法: python test-webhook.py [test-type]')
        print('可用的测试类型:')
        for t in valid_types:
            print(f'  - {t}')
        print('  - all (运行所有测试)')
        sys.exit(1)
    
    print(f'API密钥: {API_KEY}')
    print(f'Webhook URL: {WEBHOOK_URL}')
    
    if test_type == 'all':
        # 运行所有测试
        for t in valid_types:
            send_test_request(t)
            time.sleep(1)  # 避免请求过快
    else:
        send_test_request(test_type)

if __name__ == '__main__':
    main()