'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface OrderDetails {
  orderId: string;
  amount: number;  // 实际支付金额
  displayAmount?: number;  // 显示金额
  paymentMethod: string;
  productName: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  paymentId?: string;
}

export default function SuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/order-status?orderId=${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      }
    } catch (error) {
      console.error('获取订单详情失败:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId, fetchOrderDetails]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-neutral-900">
        <div className="text-xl dark:text-white">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-neutral-900">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-neutral-300">订单不存在</p>
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

  if (order.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">订单已过期</h2>
          <p className="text-gray-600 dark:text-neutral-300 mb-4">该订单已超过支付期限</p>
          <button
            onClick={() => router.push('/demo')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回商城
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-neutral-900 dark:to-neutral-800 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg dark:shadow-neutral-900/50 p-8">
          {/* 成功图标 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full mb-4">
              <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">支付成功！</h1>
            <p className="text-gray-600 dark:text-neutral-300">您的订单已成功支付</p>
          </div>

          {/* 订单信息 */}
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">订单详情</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-300">订单号：</span>
                <span className="font-mono font-semibold dark:text-white">{order.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-300">商品名称：</span>
                <span className="dark:text-white">{order.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-300">支付金额：</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ¥{Number(order.amount).toFixed(2)}
                  </span>
                  {order.displayAmount && order.displayAmount !== order.amount && (
                    <div className="text-xs text-gray-500 dark:text-neutral-400">
                      原价¥{order.displayAmount.toFixed(2)} + 随机{((order.amount - order.displayAmount) * 100).toFixed(0)}分
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-300">支付方式：</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  order.paymentMethod === 'alipay'
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                    : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                }`}>
                  {order.paymentMethod === 'alipay' ? '支付宝' : '微信支付'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-300">下单时间：</span>
                <span className="dark:text-white">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-neutral-300">支付时间：</span>
                  <span className="dark:text-white">{new Date(order.paidAt).toLocaleString('zh-CN')}</span>
                </div>
              )}
              {order.paymentId && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-neutral-300">支付流水号：</span>
                  <span className="text-sm font-mono dark:text-white">{order.paymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* 后续步骤 */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">✨ 测试成功！</h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
              恭喜！您已成功完成整个支付流程测试：
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-600 dark:text-blue-300 space-y-1">
              <li>创建订单</li>
              <li>展示收款二维码</li>
              <li>支付并填写订单号</li>
              <li>系统自动识别并更新状态</li>
              <li>支付成功确认</li>
            </ol>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/demo')}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              继续测试
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 font-semibold"
            >
              返回管理后台
            </button>
          </div>

          {/* 集成说明 */}
          <div className="mt-8 pt-8 border-t dark:border-neutral-700">
            <h3 className="font-semibold mb-3 dark:text-white">🔧 如何集成到您的网站？</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-300">
              <p>1. 部署此收款系统到您的服务器</p>
              <p>2. 在您的网站创建订单时，生成唯一订单号</p>
              <p>3. 展示收款二维码，提示用户填写订单号</p>
              <p>4. 配置回调URL接收支付通知</p>
              <p>5. 在回调中处理订单状态更新</p>
            </div>
            <div className="mt-4 p-3 bg-gray-100 dark:bg-neutral-900 rounded">
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                需要技术支持？查看 <a href="/api-docs" className="text-blue-600 dark:text-blue-400 hover:underline">API文档</a> 或联系技术支持
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}