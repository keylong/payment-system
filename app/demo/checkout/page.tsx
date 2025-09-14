'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  
  const orderId = searchParams.get('orderId');
  const amount = parseFloat(searchParams.get('amount') || '0'); // 实际支付金额
  const displayAmount = parseFloat(searchParams.get('displayAmount') || searchParams.get('amount') || '0'); // 显示金额
  const method = searchParams.get('method') as 'alipay' | 'wechat';
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // 初始为0，等待计算
  const [orderStatus, setOrderStatus] = useState<'pending' | 'success' | 'expired'>('pending');
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [orderCreatedAt, setOrderCreatedAt] = useState<Date | null>(null);

  // 计算基于订单创建时间的剩余时间
  const calculateTimeLeft = useCallback((createdAt: Date) => {
    const now = new Date();
    const elapsed = now.getTime() - createdAt.getTime();
    const totalTime = 15 * 60 * 1000; // 15分钟总时长
    const remaining = Math.max(0, Math.floor((totalTime - elapsed) / 1000));
    return remaining;
  }, []);

  // 获取订单信息和二维码
  useEffect(() => {
    const fetchQRCode = async () => {
      try {
        const response = await fetch(`/api/qrcode?type=${method}&amount=${amount}`);
        if (response.ok) {
          const data = await response.json();
          setQrCode(data.qrCode);
        }
      } catch (error) {
        console.error('获取二维码失败:', error);
      }
    };
    
    if (orderId && method) {
      fetchQRCode();
    }
  }, [orderId, method, amount]);

  // 倒计时 - 基于真实时间计算
  useEffect(() => {
    if (!orderCreatedAt || orderStatus !== 'pending') return;
    
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(orderCreatedAt);
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        setOrderStatus('expired');
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [orderCreatedAt, orderStatus, calculateTimeLeft]);

  // 查询订单状态
  const checkOrderStatus = useCallback(async () => {
    if (!orderId) return;
    
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/order-status?orderId=${orderId}`);
      if (response.ok) {
        const data = await response.json();
        
        // 首次获取订单信息时，设置创建时间并计算剩余时间
        if (!orderCreatedAt && data.createdAt) {
          const createdAt = new Date(data.createdAt);
          setOrderCreatedAt(createdAt);
          const remaining = calculateTimeLeft(createdAt);
          setTimeLeft(remaining);
        }
        
        if (data.status === 'success') {
          setOrderStatus('success');
          toast.success('支付成功！正在跳转...');
          setTimeout(() => {
            router.push(`/demo/success?orderId=${orderId}`);
          }, 2000);
        } else if (data.status === 'expired') {
          setOrderStatus('expired');
          setTimeLeft(0);
        }
      }
    } catch (error) {
      console.error('查询订单状态失败:', error);
    } finally {
      setCheckingStatus(false);
    }
  }, [orderId, orderCreatedAt, calculateTimeLeft, router, toast]);

  // 初始查询和定期查询订单状态
  useEffect(() => {
    if (orderId) {
      // 立即查询一次
      checkOrderStatus();
      // 然后定期查询
      const interval = setInterval(checkOrderStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [orderId, checkOrderStatus]);

  // 复制订单号
  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success('订单号已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 模拟支付
  const simulatePayment = async () => {
    try {
      const testData = {
        message: `${method === 'alipay' ? 'com.eg.android.AlipayGphone' : 'com.tencent.mm'}
时间
${new Date().toISOString()}
来源
${method === 'alipay' ? 'com.eg.android.AlipayGphone' : 'com.tencent.mm'}
${method === 'alipay' ? '已转入余额' : '已收款'}
你已成功收款${amount.toFixed(2)}元
UID：${orderId}
${new Date().toISOString()}`
      };

      const response = await fetch('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (response.ok) {
        toast.success('模拟支付成功！等待订单状态更新...');
      } else {
        toast.error('模拟支付失败，请重试');
      }
    } catch (error) {
      toast.error('模拟支付出错，请检查网络');
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">无效的订单</p>
          <button
            onClick={() => router.push('/demo')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回商城
          </button>
        </div>
      </div>
    );
  }

  if (orderStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">支付成功！</h2>
          <p className="text-gray-600">正在跳转到订单详情...</p>
        </div>
      </div>
    );
  }

  if (orderStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">订单已过期</h2>
          <p className="text-gray-600 mb-4">该订单已超过15分钟支付期限</p>
          <button
            onClick={() => router.push('/demo')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            重新下单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* 头部信息 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">扫码支付</h1>
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">实际支付：</span>
                <span className="text-2xl font-bold text-red-600">¥{amount.toFixed(2)}</span>
                {displayAmount !== amount && (
                  <span className="text-sm text-orange-600">
                    (含{((amount - displayAmount) * 100).toFixed(0)}分叠数)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">剩余时间：</span>
                <span className={`font-mono text-lg ${timeLeft < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                  {orderCreatedAt ? formatTime(timeLeft) : '计算中...'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 左侧：二维码 */}
            <div className="text-center">
              <div className="bg-gray-50 rounded-lg p-4 inline-block">
                {qrCode ? (
                  <img 
                    src={qrCode} 
                    alt="收款二维码" 
                    className="w-64 h-64 object-contain"
                  />
                ) : (
                  <div className="w-64 h-64 bg-gray-200 flex items-center justify-center">
                    <div className="text-gray-500">
                      <div className="text-6xl mb-2">📱</div>
                      <p>二维码加载中...</p>
                      <p className="text-sm mt-2">如未配置，请在管理后台上传</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                使用{method === 'alipay' ? '支付宝' : '微信'}扫码支付
              </p>
            </div>

            {/* 右侧：支付说明 */}
            <div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-red-800 mb-2">⚠️ 重要提示</h3>
                {displayAmount !== amount && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-3">
                    <p className="text-yellow-800 text-sm">
                      💡 检测到相同金额订单，已添加<strong>{((amount - displayAmount) * 100).toFixed(0)}分</strong>（叠数便于输入）
                    </p>
                    <p className="text-red-700 text-sm font-bold mt-1">
                      请支付：<span className="text-lg">¥{amount.toFixed(2)}</span>
                    </p>
                  </div>
                )}
                <p className="text-red-700 mb-3">
                  扫码支付时，请务必在<strong>转账备注/留言</strong>中填写以下订单号：
                </p>
                <div className="bg-white rounded border-2 border-red-300 p-3 flex items-center justify-between">
                  <code className="text-lg font-mono font-bold text-red-600">
                    {orderId}
                  </code>
                  <button
                    onClick={copyOrderId}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <h4 className="font-semibold">支付步骤：</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>打开{method === 'alipay' ? '支付宝' : '微信'}扫描左侧二维码</li>
                  <li>
                    输入支付金额：<strong className="text-red-600">¥{amount.toFixed(2)}</strong>
                    {displayAmount !== amount && (
                      <span className="text-xs text-orange-600 ml-1">
                        (原价¥{displayAmount.toFixed(2)} + 叠数{((amount - displayAmount) * 100).toFixed(0)}分)
                      </span>
                    )}
                  </li>
                  <li>
                    在备注/留言中填写：<strong className="text-red-600">{orderId}</strong>
                  </li>
                  <li>确认支付</li>
                  <li>等待系统自动确认（约3-5秒）</li>
                </ol>
              </div>

              {/* 订单状态 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">订单状态：</span>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${
                    checkingStatus ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {checkingStatus ? '查询中...' : '等待支付'}
                  </span>
                </div>
              </div>

              {/* 测试按钮 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">🧪 测试功能</p>
                <button
                  onClick={simulatePayment}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  模拟支付（自动填写备注）
                </button>
                <p className="text-xs text-blue-600 mt-2">
                  点击后将自动发送包含正确订单号的支付通知
                </p>
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="mt-6 flex space-x-4">
            <button
              onClick={() => router.push('/demo')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              返回商城
            </button>
            <button
              onClick={checkOrderStatus}
              disabled={checkingStatus}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {checkingStatus ? '查询中...' : '手动查询支付状态'}
            </button>
          </div>
        </div>

        {/* 帮助信息 */}
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">❓ 常见问题</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <details>
              <summary className="cursor-pointer hover:text-gray-800">为什么要填写订单号？</summary>
              <p className="mt-1 pl-4">系统通过订单号来识别是哪笔订单的支付，确保资金对应正确。</p>
            </details>
            <details>
              <summary className="cursor-pointer hover:text-gray-800">支付后多久到账？</summary>
              <p className="mt-1 pl-4">正常情况下3-5秒内系统会自动确认，如超过1分钟请联系客服。</p>
            </details>
            <details>
              <summary className="cursor-pointer hover:text-gray-800">忘记填写订单号怎么办？</summary>
              <p className="mt-1 pl-4">请保留支付截图，联系客服人工处理。</p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}