'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';

interface Merchant {
  id: string;
  code: string | null;
  name: string | null;
  callbackUrl: string | null;
  apiKey: string | null;
  description: string | null;
  webhookSecret: string | null;
  allowedIps: string | null;
  callbackRetryTimes: number | null;
  callbackTimeout: number | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface MerchantFormData {
  code: string;
  name: string;
  callbackUrl: string;
  apiKey: string;
  description: string;
  webhookSecret: string;
  allowedIps: string;
  callbackRetryTimes: number;
  callbackTimeout: number;
}

const defaultFormData: MerchantFormData = {
  code: '',
  name: '',
  callbackUrl: '',
  apiKey: '',
  description: '',
  webhookSecret: '',
  allowedIps: '',
  callbackRetryTimes: 3,
  callbackTimeout: 30,
};

export default function MerchantManager() {
  const toast = useToast();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState<MerchantFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // 加载商户列表
  const fetchMerchants = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/merchants');
      if (!response.ok) {
        throw new Error('获取商户列表失败');
      }
      const data = await response.json();
      setMerchants(data.merchants || []);
    } catch (error) {
      console.error('获取商户列表失败:', error);
      toast.error('获取商户列表失败');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  // 打开创建商户弹窗
  const handleCreate = () => {
    setEditingMerchant(null);
    setFormData(defaultFormData);
    setShowModal(true);
  };

  // 打开编辑商户弹窗
  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      code: merchant.code || '',
      name: merchant.name || '',
      callbackUrl: merchant.callbackUrl || '',
      apiKey: merchant.apiKey || '',
      description: merchant.description || '',
      webhookSecret: merchant.webhookSecret || '',
      allowedIps: merchant.allowedIps || '',
      callbackRetryTimes: merchant.callbackRetryTimes || 3,
      callbackTimeout: merchant.callbackTimeout || 30,
    });
    setShowModal(true);
  };

  // 保存商户
  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('商户代码和名称为必填项');
      return;
    }

    try {
      setSaving(true);
      const url = '/api/merchants';
      const method = editingMerchant ? 'PUT' : 'POST';
      const body = editingMerchant
        ? { id: editingMerchant.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }

      toast.success(editingMerchant ? '商户更新成功' : '商户创建成功');
      setShowModal(false);
      fetchMerchants();
    } catch (error) {
      console.error('保存商户失败:', error);
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 切换商户状态
  const handleToggleStatus = async (merchant: Merchant) => {
    try {
      const response = await fetch('/api/merchants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: merchant.id,
          isActive: !merchant.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('更新状态失败');
      }

      toast.success(merchant.isActive ? '商户已禁用' : '商户已启用');
      fetchMerchants();
    } catch (error) {
      console.error('更新状态失败:', error);
      toast.error('更新状态失败');
    }
  };

  // 删除商户
  const handleDelete = async (merchant: Merchant) => {
    if (merchant.id === 'default') {
      toast.error('不能删除默认商户');
      return;
    }

    if (!confirm(`确定要删除商户 "${merchant.name}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/merchants?id=${merchant.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      toast.success('商户删除成功');
      fetchMerchants();
    } catch (error) {
      console.error('删除商户失败:', error);
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 生成随机密钥
  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, apiKey: key }));
  };

  // 切换密钥显示
  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-neutral-400">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      {/* 头部 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">商户管理</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            管理不同项目/网站的回调配置
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          添加商户
        </button>
      </div>

      {/* 商户列表 */}
      <div className="space-y-4">
        {merchants.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-neutral-900 rounded-lg">
            <div className="text-gray-500 dark:text-neutral-400 mb-4">暂无商户</div>
            <button
              onClick={handleCreate}
              className="text-blue-600 hover:text-blue-800"
            >
              创建第一个商户
            </button>
          </div>
        ) : (
          merchants.map((merchant) => (
            <div
              key={merchant.id}
              className={`bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-lg p-4 sm:p-6 ${
                !merchant.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* 商户信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{merchant.name}</h3>
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 font-mono">
                      {merchant.code}
                    </span>
                    {merchant.id === 'default' && (
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                        默认
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        merchant.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {merchant.isActive ? '启用' : '禁用'}
                    </span>
                  </div>

                  {merchant.description && (
                    <p className="text-sm text-gray-600 dark:text-neutral-300 mb-3">{merchant.description}</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">回调URL:</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {merchant.callbackUrl || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">API密钥:</span>
                      <span className="font-mono text-xs">
                        {merchant.apiKey ? '••••••••' : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">重试次数:</span>
                      <span>{merchant.callbackRetryTimes || 3} 次</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">超时时间:</span>
                      <span>{merchant.callbackTimeout || 30} 秒</span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex sm:flex-col gap-2">
                  <button
                    onClick={() => handleEdit(merchant)}
                    className="flex-1 sm:flex-none px-3 py-2 text-sm border dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggleStatus(merchant)}
                    className={`flex-1 sm:flex-none px-3 py-2 text-sm border dark:border-neutral-600 rounded ${
                      merchant.isActive
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {merchant.isActive ? '禁用' : '启用'}
                  </button>
                  {merchant.id !== 'default' && (
                    <button
                      onClick={() => handleDelete(merchant)}
                      className="flex-1 sm:flex-none px-3 py-2 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b dark:border-neutral-700">
              <h3 className="text-lg font-semibold">
                {editingMerchant ? '编辑商户' : '创建商户'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                    商户代码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="例如: shop_a, project_1"
                    className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                    disabled={editingMerchant?.id === 'default'}
                  />
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">用于API调用时识别商户</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                    商户名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如: 商铺A"
                    className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="商户描述信息"
                  className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                />
              </div>

              {/* 回调配置 */}
              <div className="border-t dark:border-neutral-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">回调配置</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                      回调URL
                    </label>
                    <input
                      type="url"
                      value={formData.callbackUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, callbackUrl: e.target.value }))}
                      placeholder="https://your-domain.com/callback"
                      className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">支付成功后回调的URL地址</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                      API密钥
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showSecrets['apiKey'] ? 'text' : 'password'}
                          value={formData.apiKey}
                          onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                          placeholder="用于签名验证的密钥"
                          className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleSecretVisibility('apiKey')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-300"
                        >
                          {showSecrets['apiKey'] ? '隐藏' : '显示'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={generateApiKey}
                        className="px-3 py-2 border dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm whitespace-nowrap"
                      >
                        生成密钥
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                        重试次数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={formData.callbackRetryTimes}
                        onChange={(e) => setFormData(prev => ({ ...prev, callbackRetryTimes: parseInt(e.target.value) || 3 }))}
                        className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                        超时时间 (秒)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={formData.callbackTimeout}
                        onChange={(e) => setFormData(prev => ({ ...prev, callbackTimeout: parseInt(e.target.value) || 30 }))}
                        className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 安全配置 */}
              <div className="border-t dark:border-neutral-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">安全配置 (可选)</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                      Webhook签名密钥
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['webhookSecret'] ? 'text' : 'password'}
                        value={formData.webhookSecret}
                        onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
                        placeholder="用于验证Webhook来源"
                        className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecretVisibility('webhookSecret')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-300"
                      >
                        {showSecrets['webhookSecret'] ? '隐藏' : '显示'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1">
                      IP白名单
                    </label>
                    <input
                      type="text"
                      value={formData.allowedIps}
                      onChange={(e) => setFormData(prev => ({ ...prev, allowedIps: e.target.value }))}
                      placeholder="192.168.1.1,10.0.0.1 (逗号分隔)"
                      className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">允许访问的IP地址，留空则不限制</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
