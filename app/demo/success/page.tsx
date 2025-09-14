'use client';

import { useEffect, useState } from 'react';
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

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
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
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">订单不存在</p>
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
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">订单已过期</h2>
          <p className="text-gray-600 mb-4">该订单已超过支付期限</p>
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* 成功图标 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">支付成功！</h1>
            <p className="text-gray-600">您的订单已成功支付</p>
          </div>

          {/* 订单信息 */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">订单详情</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">订单号：</span>
                <span className="font-mono font-semibold">{order.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">商品名称：</span>
                <span>{order.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">支付金额：</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-green-600">
                    ¥{Number(order.amount).toFixed(2)}
                  </span>
                  {order.displayAmount && order.displayAmount !== order.amount && (
                    <div className="text-xs text-gray-500">
                      原价¥{order.displayAmount.toFixed(2)} + 随机{((order.amount - order.displayAmount) * 100).toFixed(0)}分
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">支付方式：</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  order.paymentMethod === 'alipay' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {order.paymentMethod === 'alipay' ? '支付宝' : '微信支付'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">下单时间：</span>
                <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">支付时间：</span>
                  <span>{new Date(order.paidAt).toLocaleString('zh-CN')}</span>
                </div>
              )}
              {order.paymentId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">支付流水号：</span>
                  <span className="text-sm font-mono">{order.paymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* 后续步骤 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">✨ 测试成功！</h3>
            <p className="text-blue-700 text-sm mb-2">
              恭喜！您已成功完成整个支付流程测试：
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-600 space-y-1">
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
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              返回管理后台
            </button>
          </div>

          {/* 集成说明 */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="font-semibold mb-3">🔧 如何集成到您的网站？</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>1. 部署此收款系统到您的服务器</p>
              <p>2. 在您的网站创建订单时，生成唯一订单号</p>
              <p>3. 展示收款二维码，提示用户填写订单号</p>
              <p>4. 配置回调URL接收支付通知</p>
              <p>5. 在回调中处理订单状态更新</p>
            </div>
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <p className="text-xs text-gray-500">
                需要技术支持？查看 <a href="/api-docs" className="text-blue-600 hover:underline">API文档</a> 或联系技术支持
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}