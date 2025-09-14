'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatAmount } from '@/lib/parser';
import { formatShanghaiTime } from '@/lib/timezone';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ToastProvider';

const QRCodeManager = dynamic(() => import('@/components/QRCodeManager'), { ssr: false });

interface PaymentRecord {
  id: string;
  amount: number;
  uid: string;
  paymentMethod: string;
  status: string;
  callbackStatus?: string;
  customerType?: string;
  createdAt: string;
  timestamp: string;
}

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
  paymentId?: string;
}

interface UnmatchedPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
  possibleOrderIds?: string[];
}

interface Statistics {
  total: number;
  todayCount: number;
  todayAmount: number;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  pendingCallbacks: number;
}

interface MerchantConfig {
  callbackUrl: string;
  apiKey: string;
}

const ITEMS_PER_PAGE = 20;

type TabType = 'orders' | 'unmatched' | 'payments' | 'qrcode' | 'config';

export default function Home() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig>({
    callbackUrl: '',
    apiKey: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10000);

  // 分页数据
  const paginatedPayments = payments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const paginatedOrders = orders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const fetchData = useCallback(async () => {
    try {
      const [paymentsRes, statsRes, configRes, ordersRes, unmatchedRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/statistics'),
        fetch('/api/config'),
        fetch('/api/orders'),
        fetch('/api/unmatched-payments')
      ]);

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        const allPayments = data.payments || [];
        setPayments(allPayments);
        if (activeTab === 'payments') {
          setTotalPages(Math.ceil(allPayments.length / ITEMS_PER_PAGE));
        }
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const allOrders = data.orders || [];
        setOrders(allOrders);
        if (activeTab === 'orders') {
          setTotalPages(Math.ceil(allOrders.length / ITEMS_PER_PAGE));
        }
      }

      if (unmatchedRes.ok) {
        const data = await unmatchedRes.json();
        setUnmatchedPayments(data.payments || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (configRes.ok) {
        const data = await configRes.json();
        setMerchantConfig(data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === 'orders') {
      setTotalPages(Math.ceil(orders.length / ITEMS_PER_PAGE));
    } else if (activeTab === 'payments') {
      setTotalPages(Math.ceil(payments.length / ITEMS_PER_PAGE));
    }
  }, [activeTab, orders.length, payments.length]);

  const saveConfig = async () => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merchantConfig)
      });

      if (res.ok) {
        toast.success('配置保存成功');
      } else {
        toast.error('保存失败');
      }
    } catch {
      toast.error('保存出错，请重试');
    }
  };

  const confirmMatch = async (paymentId: string, orderId: string) => {
    try {
      const response = await fetch('/api/confirm-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, orderId })
      });

      if (response.ok) {
        toast.success('匹配确认成功');
        fetchData();
      }
    } catch {
      toast.error('确认失败，请重试');
    }
  };

  const ignorePayment = async (paymentId: string) => {
    try {
      const response = await fetch('/api/unmatched-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ignore', paymentId })
      });

      if (response.ok) {
        toast.success('已忽略此支付');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || '忽略失败');
      }
    } catch {
      toast.error('忽略失败，请重试');
    }
  };

  const retryCallback = async (orderId: string) => {
    try {
      const order = orders.find(o => o.orderId === orderId);
      if (!order || !order.paymentId) {
        toast.warning('订单未支付或无支付记录');
        return;
      }

      const payment = payments.find(p => p.id === order.paymentId);
      if (!payment) {
        toast.error('找不到支付记录');
        return;
      }

      const res = await fetch('/api/retry-callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds: [payment.id] })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success > 0) {
          toast.success(`回调完成: ${data.success} 个成功${data.failed > 0 ? `, ${data.failed} 个失败` : ''}`);
        } else {
          toast.error(`回调失败: ${data.failed} 个失败`);
        }
        fetchData();
      }
    } catch {
      toast.error('重试失败，请稍后再试');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });

      if (res.ok) {
        toast.success('订单状态更新成功');
        fetchData();
      }
    } catch {
      toast.error('更新失败，请重试');
    }
  };

  const testWebhook = async () => {
    const testData = {
      message: `com.eg.android.AlipayGphone
时间
${new Date().toISOString()}
来源
com.eg.android.AlipayGphone
com.eg.android.AlipayGphone
已转入余额  邀商家用收钱码可赚15元>>
你已成功收款0.01元（测试订单）
UID：TEST${Date.now()}
${new Date().toISOString()}`
    };

    try {
      const res = await fetch('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (res.ok) {
        toast.success('测试消息发送成功');
        fetchData();
      } else {
        toast.error('测试失败');
      }
    } catch {
      toast.error('发送测试消息失败');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <h1 className="text-2xl sm:text-3xl font-bold">收款系统管理后台</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <a
              href="/demo"
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-purple-600 text-white rounded hover:bg-purple-700 whitespace-nowrap"
            >
              创建订单
            </a>
            <a
              href="/demo/merchant-crypto"
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-indigo-600 text-white rounded hover:bg-indigo-700 whitespace-nowrap"
            >
              商户加密演示
            </a>
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm whitespace-nowrap">自动刷新</label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-2 py-1 border rounded text-xs sm:text-sm"
                >
                  <option value={5000}>5秒</option>
                  <option value={10000}>10秒</option>
                  <option value={30000}>30秒</option>
                  <option value={60000}>1分钟</option>
                </select>
              )}
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
            >
              手动刷新
            </button>
            <button
              onClick={testWebhook}
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
            >
              发送测试
            </button>
          </div>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">待支付订单</h3>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">已完成订单</h3>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{completedOrders.length}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow relative">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">待确认支付</h3>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">{unmatchedPayments.length}</p>
              {unmatchedPayments.length > 0 && (
                <span className="absolute top-2 right-2 flex h-2 w-2 sm:h-3 sm:w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-orange-500"></span>
                </span>
              )}
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">今日订单</h3>
              <p className="text-lg sm:text-2xl font-bold">{stats.todayCount}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">今日金额</h3>
              <p className="text-lg sm:text-2xl font-bold">{formatAmount(stats.todayAmount)}</p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h3 className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">总金额</h3>
              <p className="text-lg sm:text-2xl font-bold">{formatAmount(stats.totalAmount)}</p>
            </div>
          </div>
        )}


        {/* Tab 导航 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="-mb-px flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-3 px-4 sm:px-6 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                订单管理
              </button>
              <button
                onClick={() => setActiveTab('unmatched')}
                className={`py-3 px-4 sm:px-6 border-b-2 font-medium text-xs sm:text-sm relative whitespace-nowrap ${
                  activeTab === 'unmatched'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                待确认
                {unmatchedPayments.length > 0 && (
                  <span className="ml-1 sm:ml-2 inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
                    {unmatchedPayments.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-3 px-4 sm:px-6 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                支付记录
              </button>
              <button
                onClick={() => setActiveTab('qrcode')}
                className={`py-3 px-4 sm:px-6 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'qrcode'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                二维码管理
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`py-3 px-4 sm:px-6 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'config'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                系统配置
              </button>
            </nav>
          </div>

          {/* Tab 内容 */}
          <div className="p-3 sm:p-6">
            {/* 订单管理 Tab */}
            {activeTab === 'orders' && (
              <div>
                {/* 移动端卡片视图 */}
                <div className="block sm:hidden space-y-4">
                  {paginatedOrders.map(order => (
                    <div key={order.orderId} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-mono text-gray-600 truncate flex-1 mr-2">
                          {order.orderId}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                          {order.status === 'pending' ? '待支付' : 
                           order.status === 'success' ? '已支付' : '失败'}
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-2">{order.productName}</div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>显示: {formatAmount(order.displayAmount || order.amount)}</span>
                        <span className="font-bold">实际: {formatAmount(order.actualAmount || order.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          order.paymentMethod === 'alipay' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {order.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                        </span>
                        <div className="flex space-x-2 text-xs">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => updateOrderStatus(order.orderId, 'success')}
                              className="text-green-600 hover:text-green-800"
                            >
                              标记已付
                            </button>
                          )}
                          {order.status === 'success' && (
                            <button
                              onClick={() => retryCallback(order.orderId)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              重试回调
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {formatShanghaiTime(new Date(order.createdAt))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 桌面端表格视图 */}
                <div className="hidden sm:block overflow-x-auto">
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedOrders.map(order => (
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
                                (+{((order.actualAmount - (order.displayAmount || order.amount)) * 100).toFixed(0)}分叠数)
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
                            {formatShanghaiTime(new Date(order.createdAt))}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex space-x-2">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => updateOrderStatus(order.orderId, 'success')}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  标记已付
                                </button>
                              )}
                              {order.status === 'success' && (
                                <>
                                  <button
                                    onClick={() => retryCallback(order.orderId)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    重试回调
                                  </button>
                                  <button
                                    onClick={() => updateOrderStatus(order.orderId, 'pending')}
                                    className="text-yellow-600 hover:text-yellow-800"
                                  >
                                    标记未付
                                  </button>
                                </>
                              )}
                            </div>
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
            )}

            {/* 支付记录 Tab */}
            {activeTab === 'payments' && (
              <div>
                {/* 移动端卡片视图 */}
                <div className="block sm:hidden space-y-4">
                  {paginatedPayments.map((payment) => (
                    <div key={payment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-mono text-gray-600 truncate flex-1 mr-2">
                          {payment.id}
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          {formatAmount(payment.amount)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        UID: {payment.uid}
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          payment.paymentMethod === 'alipay' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {payment.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {payment.customerType || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          payment.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {payment.status === 'success' ? '成功' : '失败'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          payment.callbackStatus === 'sent' ? 'bg-green-100 text-green-800' : 
                          payment.callbackStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.callbackStatus === 'sent' ? '已发送' : 
                           payment.callbackStatus === 'pending' ? '待发送' : '失败'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatShanghaiTime(new Date(payment.createdAt))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 桌面端表格视图 */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UID/订单号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付方式</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户类型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">回调状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium">{payment.id}</td>
                          <td className="px-6 py-4 text-sm">{formatAmount(payment.amount)}</td>
                          <td className="px-6 py-4 text-sm">{payment.uid}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              payment.paymentMethod === 'alipay' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {payment.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">{payment.customerType || '-'}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              payment.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {payment.status === 'success' ? '成功' : '失败'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              payment.callbackStatus === 'sent' ? 'bg-green-100 text-green-800' : 
                              payment.callbackStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {payment.callbackStatus === 'sent' ? '已发送' : 
                               payment.callbackStatus === 'pending' ? '待发送' : '失败'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatShanghaiTime(new Date(payment.createdAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      暂无支付记录
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 待确认支付 Tab */}
            {activeTab === 'unmatched' && (
              <div>
                {unmatchedPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">没有待确认的支付</h3>
                    <p className="text-gray-600">所有支付都已成功匹配到对应订单</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="text-sm text-yellow-800">
                          <p className="font-semibold mb-1">需要手动确认的支付</p>
                          <p>这些支付无法自动匹配到订单，请选择对应的订单或忽略无效支付</p>
                        </div>
                      </div>
                    </div>

                    {unmatchedPayments.map(payment => (
                      <div key={payment.id} className="bg-white border rounded-lg p-3 sm:p-4 md:p-6">
                        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                          {/* 支付信息 */}
                          <div>
                            <h4 className="font-semibold mb-3 text-sm sm:text-base">支付信息</h4>
                            <div className="space-y-2 text-xs sm:text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">支付ID：</span>
                                <span className="font-mono text-xs">{payment.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">支付金额：</span>
                                <span className="font-bold text-base sm:text-lg text-green-600">¥{payment.amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">支付方式：</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  payment.paymentMethod === 'alipay' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {payment.paymentMethod === 'alipay' ? '支付宝' : '微信'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">收款时间：</span>
                                <span className="text-xs">{formatShanghaiTime(new Date(payment.createdAt))}</span>
                              </div>
                            </div>
                          </div>

                          {/* 右侧：匹配操作 */}
                          <div>
                            <h4 className="font-semibold mb-3">匹配订单</h4>
                            {payment.possibleOrderIds && payment.possibleOrderIds.length > 0 ? (
                              <div className="space-y-3">
                                <p className="text-sm text-gray-600">找到 {payment.possibleOrderIds.length} 个可能的订单：</p>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      confirmMatch(payment.id, e.target.value);
                                    }
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">请选择订单</option>
                                  {payment.possibleOrderIds.map(orderId => {
                                    const order = orders.find(o => o.orderId === orderId);
                                    return (
                                      <option key={orderId} value={orderId}>
                                        {orderId} - {order?.productName} - ¥{order?.actualAmount || order?.amount}
                                      </option>
                                    );
                                  })}
                                </select>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                  <button
                                    onClick={() => confirmMatch(payment.id, payment.possibleOrderIds![0])}
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                                  >
                                    确认第一个
                                  </button>
                                  <button
                                    onClick={() => ignorePayment(payment.id)}
                                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                                  >
                                    忽略此支付
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-red-50 rounded-lg p-3 sm:p-4">
                                <p className="text-sm text-red-700 mb-2">
                                  ⚠️ 没有找到匹配的订单
                                </p>
                                <p className="text-xs text-red-600 mb-3">
                                  可能原因：金额不匹配、订单已支付、订单已取消
                                </p>
                                <button
                                  onClick={() => ignorePayment(payment.id)}
                                  className="w-full px-3 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 text-sm"
                                >
                                  忽略此支付
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 二维码管理 Tab */}
            {activeTab === 'qrcode' && (
              <div>
                <QRCodeManager />
              </div>
            )}

            {/* 系统配置 Tab - 移动端优化 */}
            {activeTab === 'config' && (
              <div className="max-w-2xl">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">回调URL</label>
                    <input
                      type="text"
                      value={merchantConfig.callbackUrl}
                      onChange={(e) => setMerchantConfig({...merchantConfig, callbackUrl: e.target.value})}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="http://your-server.com/callback"
                    />
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      支付成功后系统会向此URL发送通知
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">API密钥</label>
                    <input
                      type="text"
                      value={merchantConfig.apiKey}
                      onChange={(e) => setMerchantConfig({...merchantConfig, apiKey: e.target.value})}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="your-api-key"
                    />
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      用于签名验证，确保数据安全
                    </p>
                  </div>
                  <button
                    onClick={saveConfig}
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    保存配置
                  </button>
                </div>

                {/* 系统说明 - 移动端优化 */}
                <div className="mt-6 sm:mt-8 bg-blue-50 rounded-lg p-3 sm:p-4">
                  <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">💡 系统使用说明</h4>
                  <ul className="space-y-1 text-xs sm:text-sm text-blue-700">
                    <li>• 智能检测金额冲突，只在需要时添加叠数小额（11、22、33等）</li>
                    <li>• 叠数设计便于用户输入，如 10.22、10.33、10.44</li>
                    <li>• 收到支付通知后，系统自动根据金额匹配对应订单</li>
                    <li>• 如果有多个相同金额的订单，需要手动确认匹配</li>
                    <li>• 支付记录仅供查看，订单状态在订单管理中调整</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 分页 - 移动端优化 */}
          {((activeTab === 'orders' && orders.length > ITEMS_PER_PAGE) ||
            (activeTab === 'payments' && payments.length > ITEMS_PER_PAGE)) && (
            <div className="px-3 sm:px-6 py-4 border-t flex justify-center items-center">
              {/* 移动端简化分页 */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  上一页
                </button>
                
                {/* 移动端显示页码信息 */}
                <div className="hidden sm:flex space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPage === pageNum 
                            ? 'bg-blue-600 text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                {/* 移动端简化页码显示 */}
                <div className="sm:hidden px-3 py-1 text-sm text-gray-600 bg-gray-50 rounded">
                  {currentPage} / {totalPages}
                </div>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}