'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import Image from 'next/image';

interface QRCode {
  id: string;
  type: 'alipay' | 'wechat';
  image: string;
  minAmount?: number;
  maxAmount?: number;
  fixedAmount?: number;
  isActive: boolean;
  uploadedAt: string;
}

export default function QRCodeManager() {
  const toast = useToast();
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'alipay' | 'wechat'>('alipay');
  const [amountType, setAmountType] = useState<'any' | 'fixed' | 'range'>('any');
  const [fixedAmount, setFixedAmount] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [uploading, setUploading] = useState(false);

  // 获取二维码列表
  const fetchQRCodes = async () => {
    try {
      const response = await fetch('/api/qrcode/list');
      if (response.ok) {
        const data = await response.json();
        setQrCodes(data.qrCodes || []);
      }
    } catch (error) {
      console.error('获取二维码列表失败:', error);
    }
  };

  useEffect(() => {
    fetchQRCodes();
  }, []);

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    setUploading(true);

    try {
      // 转换为Base64
      const base64 = await fileToBase64(file);
      
      // 准备上传数据
      interface UploadData {
        type: string;
        image: string;
        amount?: number;
        fixedAmount?: number;
        minAmount?: number;
        maxAmount?: number;
      }
      
      const uploadData: UploadData = {
        type: uploadType,
        image: base64
      };

      // 根据金额类型设置参数
      if (amountType === 'fixed' && fixedAmount) {
        uploadData.fixedAmount = parseFloat(fixedAmount);
      } else if (amountType === 'range' && minAmount && maxAmount) {
        uploadData.minAmount = parseFloat(minAmount);
        uploadData.maxAmount = parseFloat(maxAmount);
      }

      // 上传到服务器
      const response = await fetch('/api/qrcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadData)
      });

      if (response.ok) {
        toast.success('二维码上传成功');
        setShowUpload(false);
        resetForm();
        fetchQRCodes();
      } else {
        toast.error('上传失败，请重试');
      }
    } catch (error) {
      console.error('上传错误:', error);
      toast.error('上传失败，请检查网络');
    } finally {
      setUploading(false);
    }
  };

  // 删除二维码
  const deleteQRCode = async (id: string) => {
    if (!window.confirm('确定要删除这个二维码吗？')) return;

    try {
      const response = await fetch(`/api/qrcode?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('删除成功');
        fetchQRCodes();
      } else {
        toast.error('删除失败，请重试');
      }
    } catch (error) {
      console.error('删除错误:', error);
      toast.error('删除失败，请稍后再试');
    }
  };

  // 文件转Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 重置表单
  const resetForm = () => {
    setAmountType('any');
    setFixedAmount('');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">收款二维码管理</h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          上传二维码
        </button>
      </div>

      {/* 上传表单 */}
      {showUpload && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-4">上传新的收款二维码</h3>
          
          <div className="space-y-4">
            {/* 支付方式选择 */}
            <div>
              <label className="block text-sm font-medium mb-2">支付方式</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="alipay"
                    checked={uploadType === 'alipay'}
                    onChange={(e) => setUploadType(e.target.value as 'alipay')}
                    className="mr-2"
                  />
                  支付宝
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="wechat"
                    checked={uploadType === 'wechat'}
                    onChange={(e) => setUploadType(e.target.value as 'wechat')}
                    className="mr-2"
                  />
                  微信支付
                </label>
              </div>
            </div>

            {/* 金额设置 */}
            <div>
              <label className="block text-sm font-medium mb-2">金额设置</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="any"
                    checked={amountType === 'any'}
                    onChange={(e) => setAmountType(e.target.value as 'any' | 'fixed' | 'range')}
                    className="mr-2"
                  />
                  任意金额
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="fixed"
                    checked={amountType === 'fixed'}
                    onChange={(e) => setAmountType(e.target.value as 'any' | 'fixed' | 'range')}
                    className="mr-2"
                  />
                  固定金额
                  {amountType === 'fixed' && (
                    <input
                      type="number"
                      step="0.01"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                      placeholder="输入金额"
                      className="ml-2 px-2 py-1 border rounded w-24"
                    />
                  )}
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="range"
                    checked={amountType === 'range'}
                    onChange={(e) => setAmountType(e.target.value as 'any' | 'fixed' | 'range')}
                    className="mr-2"
                  />
                  金额范围
                  {amountType === 'range' && (
                    <div className="ml-2 flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        placeholder="最小"
                        className="px-2 py-1 border rounded w-20"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        step="0.01"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        placeholder="最大"
                        className="px-2 py-1 border rounded w-20"
                      />
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* 文件上传 */}
            <div>
              <label className="block text-sm font-medium mb-2">选择二维码图片</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploading && <p className="text-sm text-gray-500 mt-1">上传中...</p>}
            </div>
          </div>
        </div>
      )}

      {/* 二维码列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {qrCodes.map((qr) => (
          <div key={qr.id} className="border rounded-lg p-4">
            <div className="mb-2">
              <Image
                src={qr.image}
                alt={`${qr.type}二维码`}
                width={300}
                height={192}
                className="w-full h-48 object-contain bg-gray-50 rounded"
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">类型：</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  qr.type === 'alipay' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {qr.type === 'alipay' ? '支付宝' : '微信'}
                </span>
              </div>
              {qr.fixedAmount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">固定金额：</span>
                  <span>¥{qr.fixedAmount}</span>
                </div>
              )}
              {qr.minAmount && qr.maxAmount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">金额范围：</span>
                  <span>¥{qr.minAmount}-{qr.maxAmount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">状态：</span>
                <span className={`text-xs ${qr.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                  {qr.isActive ? '启用' : '禁用'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={() => deleteQRCode(qr.id)}
                className="flex-1 px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                删除
              </button>
            </div>
          </div>
        ))}
        
        {qrCodes.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            暂无二维码，请上传收款二维码
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">📌 使用说明</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• 上传您的收款二维码图片（支付宝/微信）</li>
          <li>• 可以为不同金额设置不同的二维码</li>
          <li>• 用户支付时需要在备注中填写订单号</li>
          <li>• 系统会自动识别订单号并更新支付状态</li>
        </ul>
      </div>
    </div>
  );
}