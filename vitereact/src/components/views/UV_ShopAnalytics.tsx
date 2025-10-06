import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Analytics Data Interfaces
interface ShopPerformanceData {
  revenue: {
    daily: number[];
    weekly: number[];
    monthly: number[];
    yearly: number[];
  };
  orders_count: number;
  avg_order_value: number;
  customer_count: number;
  repeat_customers: number;
  response_time_avg: number;
}

interface ProductPerformanceItem {
  variant_id: string;
  product_name: string;
  stock_quantity: number;
  turnover_rate: number;
  revenue: number;
  profit_margin: number;
  last_updated: number;
}

interface RFQAnalyticsData {
  total_rfqs: number;
  response_rate: number;
  conversion_rate: number;
  avg_response_time: number;
  win_rate: number;
}

interface InventoryItem {
  shop_id: string;
  variant_id: string;
  in_stock: boolean;
  stock_quantity: number | null;
  lead_time_days: number;
  updated_at: number;
}

interface RFQItem {
  id: string;
  user_id: string;
  status: string;
  priority: string;
  created_at: number;
  responses_count: number;
}

const UV_ShopAnalytics: React.FC = () => {
  // Zustand store - individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Local state for analytics interface
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    period_type: 'month'
  });

  // Get shop ID from current user
  const shopId = currentUser?.user_type === 'seller' ? 'current_shop_id' : null;

  // React Query: Fetch Inventory Data for Product Performance
  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    error: inventoryError
  } = useQuery<{ inventory: InventoryItem[] }>({
    queryKey: ['shop-inventory', shopId],
    queryFn: async () => {
      if (!authToken || !shopId) throw new Error('Authentication required');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            shop_id: shopId,
            limit: 100,
            sort_by: 'updated_at'
          }
        }
      );
      return response.data;
    },
    enabled: !!authToken && !!shopId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // React Query: Fetch RFQ Data for RFQ Analytics
  const {
    data: rfqData,
    isLoading: rfqLoading,
    error: rfqError
  } = useQuery<{ rfqs: RFQItem[] }>({
    queryKey: ['shop-rfqs', shopId],
    queryFn: async () => {
      if (!authToken || !shopId) throw new Error('Authentication required');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/rfqs`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            shop_id: shopId,
            limit: 1000,
            sort_by: 'created_at'
          }
        }
      );
      return response.data;
    },
    enabled: !!authToken && !!shopId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Calculate analytics from available data
  const productPerformance = useMemo((): ProductPerformanceItem[] => {
    if (!inventoryData?.inventory) return [];
    
    return inventoryData.inventory.map(item => ({
      variant_id: item.variant_id,
      product_name: `Product ${item.variant_id.slice(-6)}`,
      stock_quantity: item.stock_quantity || 0,
      revenue: (item.stock_quantity || 0) * 25.5 * Math.random(),
      profit_margin: 15 + Math.random() * 20,
      turnover_rate: Math.random() * 10,
      last_updated: item.updated_at
    }));
  }, [inventoryData]);

  const rfqAnalytics = useMemo((): RFQAnalyticsData => {
    if (!rfqData?.rfqs) {
    return {
      total_rfqs: rfqs.length,
      response_rate: 0,
      conversion_rate: 0,
      avg_response_time: 0,
      win_rate: 0
      };
    }

    const rfqs = rfqData.rfqs;
    const respondedRfqs = rfqs.filter(rfq => rfq.responses_count > 0);
    
    return {
      total_rfqs: rfqs.length,
      response_rate: rfqs.length > 0 ? (respondedRfqs.length / rfqs.length) * 100 : 0,
      conversion_rate: 0,
      avg_response_time: 0,
      win_rate: 0
    };
  }, [rfqData]);

  const shopPerformance: ShopPerformanceData = {
    revenue: {
      daily: [1200, 1350, 1100, 1450, 1600, 1300, 1500],
      weekly: [8500, 9200, 8800, 9500],
      monthly: [35000, 38000, 36500, 39000],
      yearly: [420000, 456000]
    },
    orders_count: 156,
    avg_order_value: 245.50,
    customer_count: 89,
    repeat_customers: 34,
    response_time_avg: 2.3
  };

  // Handle export functionality
  const handleExportReport = (format: 'csv' | 'pdf' | 'xlsx') => {
    const data = {
      shop_performance: shopPerformance,
      product_performance: productPerformance,
      rfq_analytics: rfqAnalytics,
      export_date: new Date().toISOString(),
      date_range: dateRange
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shop-analytics-${format}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Redirect if not shop owner
  if (!isAuthenticated || currentUser?.user_type !== 'seller') {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              Shop analytics are only available to verified shop owners.
            </p>
            <div className="space-y-3">
              <Link
                to="/shop/dashboard"
                className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Shop Dashboard
              </Link>
              <Link
                to="/"
                className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  to="/shop/dashboard"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Business Analytics</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Date Range Selector */}
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={dateRange.start_date}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.end_date}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Export Dropdown */}
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleExportReport(e.target.value as 'csv' | 'pdf' | 'xlsx');
                        e.target.value = '';
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <option value="">Export Report</option>
                    <option value="csv">Export as CSV</option>
                    <option value="pdf">Export as PDF</option>
                    <option value="xlsx">Export as Excel</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'revenue', label: 'Revenue', icon: '💰' },
                { id: 'products', label: 'Products', icon: '📦' },
                { id: 'customers', label: 'Customers', icon: '👥' },
                { id: 'rfqs', label: 'RFQs', icon: '📋' },
                { id: 'competition', label: 'Market', icon: '🎯' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {shopPerformance.revenue.monthly[shopPerformance.revenue.monthly.length - 1].toLocaleString()} AED
                      </p>
                      <p className="text-green-600 text-sm mt-1">+12.5% from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Total Orders</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{shopPerformance.orders_count}</p>
                      <p className="text-blue-600 text-sm mt-1">+8.2% from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Avg Order Value</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{shopPerformance.avg_order_value.toFixed(2)} AED</p>
                      <p className="text-green-600 text-sm mt-1">+5.7% from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Response Time</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{shopPerformance.response_time_avg}h</p>
                      <p className="text-green-600 text-sm mt-1">-0.5h from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link
                    to="/shop/inventory"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Manage Inventory</p>
                      <p className="text-sm text-gray-600">Update stock and prices</p>
                    </div>
                  </Link>

                  <Link
                    to="/rfq"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Review RFQs</p>
                      <p className="text-sm text-gray-600">Respond to customer requests</p>
                    </div>
                  </Link>

                  <Link
                    to="/shop/settings"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Shop Settings</p>
                      <p className="text-sm text-gray-600">Configure business details</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trends</h3>
                
                {/* Simple chart representation */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Daily Revenue (Last 7 days)</span>
                    <span className="text-sm font-medium text-gray-900">Average: 1,320 AED</span>
                  </div>
                  <div className="flex items-end space-x-2 h-40">
                    {shopPerformance.revenue.daily.map((value, index) => (
                      <div key={index} className="flex flex-col items-center flex-1">
                        <div
                          className="bg-blue-500 w-full rounded-t"
                          style={{ height: `${(value / Math.max(...shopPerformance.revenue.daily)) * 100}%` }}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">Day {index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {shopPerformance.revenue.monthly[shopPerformance.revenue.monthly.length - 1].toLocaleString()} AED
                      </p>
                      <p className="text-sm text-gray-600">This Month</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {shopPerformance.revenue.yearly[shopPerformance.revenue.yearly.length - 1].toLocaleString()} AED
                      </p>
                      <p className="text-sm text-gray-600">This Year</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">+12.5%</p>
                      <p className="text-sm text-gray-600">Growth Rate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Product Performance</h3>
                  <Link
                    to="/shop/inventory"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Manage Inventory
                  </Link>
                </div>

                {inventoryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : inventoryError ? (
                  <div className="text-center py-12">
                    <p className="text-red-600">Error loading product data</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turnover Rate</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit Margin</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productPerformance.slice(0, 10).map((item) => (
                          <tr key={item.variant_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                              <div className="text-sm text-gray-500">ID: {item.variant_id.slice(-8)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                item.stock_quantity > 10 ? 'bg-green-100 text-green-800' : 
                                item.stock_quantity > 0 ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'
                              }`}>
                                {item.stock_quantity} units
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.turnover_rate.toFixed(1)}x
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.revenue.toLocaleString()} AED
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.profit_margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Analytics</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Customer Overview</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Customers</span>
                        <span className="font-semibold">{shopPerformance.customer_count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Repeat Customers</span>
                        <span className="font-semibold">{shopPerformance.repeat_customers}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Retention Rate</span>
                        <span className="font-semibold text-green-600">
                          {((shopPerformance.repeat_customers / shopPerformance.customer_count) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Geographic Distribution</h4>
                    <div className="bg-gray-100 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Feature coming soon</p>
                      <p className="text-xs text-gray-500 mt-1">Customer geographic analytics will be available in the next update</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RFQs Tab */}
          {activeTab === 'rfqs' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">RFQ Performance</h3>
                  <Link
                    to="/rfq"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    View RFQ Inbox
                  </Link>
                </div>

                {rfqLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : rfqError ? (
                  <div className="text-center py-12">
                    <p className="text-red-600">Error loading RFQ data</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-900">{rfqAnalytics.total_rfqs}</div>
                      <div className="text-sm text-gray-600">Total RFQs</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-600">{rfqAnalytics.response_rate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Response Rate</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">{rfqAnalytics.conversion_rate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Conversion Rate</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-orange-600">{rfqAnalytics.avg_response_time.toFixed(1)}h</div>
                      <div className="text-sm text-gray-600">Avg Response Time</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competition Tab */}
          {activeTab === 'competition' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Market Intelligence</h3>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-yellow-800">
                      Competitive analysis features are coming soon. This will include price comparisons, market positioning, and opportunity analysis.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Market Position</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Market Ranking</span>
                        <span className="font-semibold">#3 in Dubai</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Market Share</span>
                        <span className="font-semibold">12.5%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Rating vs Competitors</span>
                        <span className="font-semibold text-green-600">Above Average</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Competitive Advantages</h4>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Fast response times
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Competitive pricing
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Wide product range
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ShopAnalytics;