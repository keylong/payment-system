'use client';

import { useState, useEffect } from 'react';
import { formatAmount } from '@/lib/parser';

interface Order {
  orderId: string;
  productName: string;
  amount: number;
  displayAmount?: number;
  actualAmount?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

interface UnmatchedPayment {
  paymentId: string;
  amount: number;
  paymentMethod: string;
  receivedAt: string;
  possibleOrderIds?: string[];
}

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/demo-order');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('获取订单失败:', error);
    }
  };

  const fetchUnmatchedPayments = async () => {
    try {
      const response = await fetch('/api/unmatched-payments');
      if (response.ok) {
        const data = await response.json();
        setUnmatchedPayments(data.payments || []);
      }
    } catch (error) {
      console.error('获取未匹配支付失败:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchUnmatchedPayments();
    const interval = setInterval(() => {
      fetchOrders();
      fetchUnmatchedPayments();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const confirmMatch = async (paymentId: string, orderId: string) => {
    try {
      const response = await fetch('/api/confirm-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, orderId })
      });

      if (response.ok) {
        alert('匹配确认成功');
        fetchOrders();
        fetchUnmatchedPayments();
      }
    } catch (error) {
      alert('确认失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const completedOrders = orders.filter(o => o.status === 'success');

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">待支付订单</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">已完成订单</div>
          <div className="text-2xl font-bold text-green-600">{completedOrders.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">待确认支付</div>
          <div className="text-2xl font-bold text-orange-600">{unmatchedPayments.length}</div>
        </div>
      </div>

      {/* 待确认支付 */}
      {unmatchedPayments.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-orange-800">⚠️ 有待确认的支付</h3>
            <button
              onClick={() => setShowUnmatched(!showUnmatched)}
              className="text-sm text-orange-600 hover:text-orange-800"
            >
              {showUnmatched ? '隐藏' : '显示'}
            </button>
          </div>
          
          {showUnmatched && (
            <div className="space-y-2">
              {unmatchedPayments.map(payment => (
                <div key={payment.paymentId} className="bg-white rounded p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono text-sm">{payment.paymentId}</span>
                      <span className="ml-2 font-bold text-green-600">
                        ¥{payment.amount.toFixed(2)}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        {payment.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {payment.possibleOrderIds && payment.possibleOrderIds.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              confirmMatch(payment.paymentId, e.target.value);
                            }
                          }}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="">选择订单</option>
                          {payment.possibleOrderIds.map(orderId => {
                            const order = orders.find(o => o.orderId === orderId);
                            return (
                              <option key={orderId} value={orderId}>
                                {orderId} - ¥{order?.actualAmount || order?.amount}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(payment.receivedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  {payment.possibleOrderIds && payment.possibleOrderIds.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      没有找到匹配的订单，请检查金额是否正确
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 订单列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">订单列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">显示金额</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">实际金额</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付方式</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map(order => (
                <tr key={order.orderId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{order.orderId}</td>
                  <td className="px-4 py-3 text-sm">{order.productName}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatAmount(order.displayAmount || order.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold">
                    {formatAmount(order.actualAmount || order.amount)}
                    {order.actualAmount && order.actualAmount !== order.displayAmount && (
                      <span className="ml-1 text-xs text-orange-600">
                        (+{((order.actualAmount - (order.displayAmount || order.amount)) * 100).toFixed(0)}分)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      order.paymentMethod === 'alipay' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {order.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                      {order.status === 'pending' ? '待支付' : 
                       order.status === 'success' ? '已支付' : '失败'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无订单
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">💡 智能匹配说明</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• 系统会为每个订单生成唯一的支付金额（原金额 + 随机小额）</li>
          <li>• 收到支付通知后，系统自动根据金额匹配对应订单</li>
          <li>• 如果有多个相同金额的订单，需要手动确认匹配</li>
          <li>• 建议间隔创建订单，避免金额冲突</li>
        </ul>
      </div>
    </div>
  );
}