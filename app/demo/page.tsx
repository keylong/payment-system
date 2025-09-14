'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

const products: Product[] = [
  {
    id: '1',
    name: '测试商品 - 基础版',
    price: 0.01,
    image: '📦',
    description: '用于测试支付流程'
  },
  {
    id: '2',
    name: '测试商品 - 标准版',
    price: 1.00,
    image: '🎁',
    description: '标准测试金额'
  },
  {
    id: '3',
    name: '测试商品 - 高级版',
    price: 10.00,
    image: '💎',
    description: '较大金额测试'
  }
];

export default function DemoShop() {
  const router = useRouter();
  const toast = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const handleCreateOrder = async () => {
    if (!selectedProduct && !customAmount) {
      toast.warning('请选择商品或输入自定义金额');
      return;
    }

    setIsCreatingOrder(true);

    try {
      const amount = customAmount ? parseFloat(customAmount) : selectedProduct!.price;
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('请输入有效的金额');
        setIsCreatingOrder(false);
        return;
      }

      // 创建订单
      const response = await fetch('/api/demo-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: selectedProduct?.id || 'custom',
          productName: selectedProduct?.name || '自定义金额',
          amount,
          paymentMethod
        })
      });

      if (response.ok) {
        const order = await response.json();
        
        // 如果实际金额与显示金额不同，给出提示
        if (order.displayAmount !== order.amount) {
          const cents = ((order.amount - order.displayAmount) * 100).toFixed(0);
          toast.info(`检测到相同金额订单，已添加 ${cents}分（叠数便于输入）`, 5000);
        }
        
        toast.success('订单创建成功，正在跳转到支付页面...');
        // 跳转到支付页面，传递实际金额和显示金额
        router.push(`/demo/checkout?orderId=${order.orderId}&amount=${order.amount}&displayAmount=${order.displayAmount}&method=${paymentMethod}`);
      } else {
        toast.error('创建订单失败，请重试');
      }
    } catch (error) {
      console.error('创建订单错误:', error);
      toast.error('创建订单失败，请检查网络连接');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-center mb-8">演示商城 - 收款测试</h1>
          
          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              💡 这是一个演示页面，用于测试收款系统的完整流程。
              选择商品或输入自定义金额后，将展示支付流程。
            </p>
          </div>

          {/* 商品列表 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">选择测试商品</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {products.map(product => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setCustomAmount('');
                  }}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    selectedProduct?.id === product.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-4xl text-center mb-2">{product.image}</div>
                  <h3 className="font-semibold text-center">{product.name}</h3>
                  <p className="text-gray-600 text-sm text-center mb-2">{product.description}</p>
                  <p className="text-2xl font-bold text-center text-blue-600">
                    ¥{product.price.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 自定义金额 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">或输入自定义金额</h2>
            <div className="flex items-center space-x-4">
              <span className="text-lg">¥</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedProduct(null);
                }}
                placeholder="输入金额"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 支付方式选择 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">选择支付方式</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => setPaymentMethod('alipay')}
                className={`flex-1 py-3 rounded-lg border transition ${
                  paymentMethod === 'alipay'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="text-lg">支付宝</span>
              </button>
              <button
                onClick={() => setPaymentMethod('wechat')}
                className={`flex-1 py-3 rounded-lg border transition ${
                  paymentMethod === 'wechat'
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="text-lg">微信支付</span>
              </button>
            </div>
          </div>

          {/* 订单信息 */}
          {(selectedProduct || customAmount) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">订单信息</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>商品名称：</span>
                  <span>{selectedProduct?.name || '自定义金额'}</span>
                </div>
                <div className="flex justify-between">
                  <span>支付金额：</span>
                  <span className="font-bold text-lg text-red-600">
                    ¥{(customAmount ? parseFloat(customAmount) : selectedProduct?.price || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>支付方式：</span>
                  <span>{paymentMethod === 'alipay' ? '支付宝' : '微信支付'}</span>
                </div>
              </div>
            </div>
          )}

          {/* 创建订单按钮 */}
          <button
            onClick={handleCreateOrder}
            disabled={isCreatingOrder || (!selectedProduct && !customAmount)}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              isCreatingOrder || (!selectedProduct && !customAmount)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isCreatingOrder ? '创建订单中...' : '立即支付'}
          </button>

          {/* 说明 */}
          <div className="mt-6 text-sm text-gray-600">
            <p className="mb-2">📌 测试流程说明：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>选择商品或输入自定义金额</li>
              <li>选择支付方式（支付宝/微信）</li>
              <li>点击立即支付创建订单</li>
              <li>在支付页面查看收款二维码</li>
              <li>扫码支付时在备注中填写订单号</li>
              <li>系统自动识别并更新订单状态</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}