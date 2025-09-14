import { Suspense } from 'react';
import CheckoutClient from './CheckoutClient';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-xl text-gray-600">加载中...</div>
              <div className="mt-4 w-64 h-64 mx-auto bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-gray-500">
                  <div className="text-6xl mb-2">📱</div>
                  <p>初始化支付页面...</p>
                </div>
              </div>
            </div>
          </div>
        }>
          <CheckoutClient />
        </Suspense>
      </div>
    </div>
  );
}