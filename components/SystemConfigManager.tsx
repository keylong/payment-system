'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';

interface ConfigDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'password' | 'json';
  defaultValue?: string;
  required?: boolean;
  category: string;
  placeholder?: string;
  sensitive?: boolean;
  value?: string;
}

interface SystemConfigData {
  categories: Record<string, string>;
  configs: ConfigDefinition[];
  category: string | null;
}

const CONFIG_ICONS = {
  webhook: '🔗',
  merchant: '🏪',
  system: '⚙️',
  payment: '💳',
  security: '🔒',
  notification: '📧'
};

export default function SystemConfigManager() {
  const toast = useToast();
  const [data, setData] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('system');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // 加载配置数据
  const fetchConfigs = async (category?: string) => {
    try {
      setLoading(true);
      const url = category ? `/api/system-config?category=${category}` : '/api/system-config';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      
      const configData: SystemConfigData = await response.json();
      setData(configData);
      
      // 初始化表单值
      const values: Record<string, string> = {};
      configData.configs.forEach(config => {
        values[config.key] = config.value || config.defaultValue || '';
      });
      setConfigValues(values);
      
    } catch (error) {
      console.error('获取系统配置失败:', error);
      toast.error('获取系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs(activeCategory);
  }, [activeCategory]);

  // 更新配置值
  const handleConfigChange = (key: string, value: string) => {
    setConfigValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 保存配置
  const handleSave = async () => {
    if (!data) return;

    try {
      setSaving(true);
      
      // 准备要更新的配置
      const configs = Object.keys(configValues).map(key => ({
        key,
        value: configValues[key]
      }));

      const response = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存配置失败');
      }

      const result = await response.json();
      toast.success(result.message || '配置保存成功');
      
      // 重新加载配置
      await fetchConfigs(activeCategory);

    } catch (error: any) {
      console.error('保存配置失败:', error);
      toast.error(error.message || '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认值
  const handleReset = async (keys: string[]) => {
    if (!confirm('确定要重置选中的配置为默认值吗？')) {
      return;
    }

    try {
      const response = await fetch('/api/system-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys })
      });

      if (!response.ok) {
        throw new Error('重置配置失败');
      }

      const result = await response.json();
      toast.success(result.message || '配置重置成功');
      
      // 重新加载配置
      await fetchConfigs(activeCategory);

    } catch (error: any) {
      console.error('重置配置失败:', error);
      toast.error(error.message || '重置配置失败');
    }
  };

  // 切换密码显示
  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 渲染配置项
  const renderConfigField = (config: ConfigDefinition) => {
    const value = configValues[config.key] || '';
    const isPassword = config.type === 'password';
    const showPassword = showPasswords[config.key];

    return (
      <div key={config.key} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            {config.label}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {config.defaultValue && (
            <button
              onClick={() => handleReset([config.key])}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              重置默认
            </button>
          )}
        </div>
        
        {config.description && (
          <p className="text-xs text-gray-500">{config.description}</p>
        )}

        <div className="relative">
          {config.type === 'boolean' ? (
            <select
              value={value}
              onChange={(e) => handleConfigChange(config.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          ) : config.type === 'json' ? (
            <textarea
              value={value}
              onChange={(e) => handleConfigChange(config.key, e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          ) : (
            <input
              type={isPassword && !showPassword ? 'password' : config.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => handleConfigChange(config.key, e.target.value)}
              placeholder={config.placeholder}
              required={config.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          
          {isPassword && (
            <button
              type="button"
              onClick={() => togglePasswordVisibility(config.key)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          )}
        </div>

        {config.defaultValue && (
          <p className="text-xs text-gray-400">
            默认值: {config.sensitive ? '***' : config.defaultValue}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">加载系统配置...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">加载配置失败</div>
        <button 
          onClick={() => fetchConfigs(activeCategory)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    );
  }

  const categoryConfigs = data.configs.filter(c => c.category === activeCategory);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 分类导航 */}
      <div className="mb-6 border-b">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {Object.entries(data.categories).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeCategory === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">
                {CONFIG_ICONS[key as keyof typeof CONFIG_ICONS] || '⚙️'}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* 配置表单 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {CONFIG_ICONS[activeCategory as keyof typeof CONFIG_ICONS] || '⚙️'} {data.categories[activeCategory]}
          </h3>
          <div className="flex space-x-3">
            <button
              onClick={() => handleReset(categoryConfigs.map(c => c.key))}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              重置全部
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {categoryConfigs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            该分类下暂无配置项
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {categoryConfigs.map(config => (
              <div key={config.key} className="border border-gray-200 rounded-lg p-4">
                {renderConfigField(config)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 帮助信息 */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">💡 配置说明</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• 标有 * 的配置项为必填项</li>
          <li>• 密码类型的配置项将加密存储</li>
          <li>• 配置更改后立即生效，无需重启系统</li>
          <li>• 可以随时重置为默认值</li>
          <li>• 敏感信息在界面上会显示为 *** 已设置 ***</li>
        </ul>
      </div>
    </div>
  );
}