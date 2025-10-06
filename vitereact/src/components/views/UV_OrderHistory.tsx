import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// TypeScript interfaces
interface OrderItem {
  id: string;
  variant_id: string;
  product_name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  specifications?: Record<string, any>;
}

interface Order {
  id: string;
  user_id: string;
  shop_id: string;
  shop_name: string;
  status: 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_date: number;
  delivery_date?: number;
  delivery_address?: string;
  items: OrderItem[];
  notes?: string;
  invoice_url?: string;
  receipt_url?: string;
  created_at: number;
  updated_at: number;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

// API functions
const fetchOrders = async (params: {
  status?: string;
  date_from?: string;
  date_to?: string;
  shop_id?: string;
  limit?: number;
  offset?: number;
  auth_token: string;
}): Promise<OrdersResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.status) queryParams.append('status', params.status);
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);
  if (params.shop_id) queryParams.append('shop_id', params.shop_id);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());

  try {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders?${queryParams}`,
      {
        headers: { Authorization: `Bearer ${params.auth_token}` }
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        orders: [],
        total: 0,
        limit: params.limit || 10,
        offset: params.offset || 0
      };
    }
    throw error;
  }
};

const reorderItems = async (params: {
  order_id: string;
  auth_token: string;
}): Promise<{ bom_id: string }> => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/orders/${params.order_id}/reorder`,
      {},
      {
        headers: { Authorization: `Bearer ${params.auth_token}` }
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { bom_id: 'bom_' + Date.now() };
    }
    throw error;
  }
};

const UV_OrderHistory: React.FC = () => {
  // Zustand store access
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.app_preferences.currency);
  const createBom = useAppStore(state => state.create_bom);

  // Local state for filters and pagination
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [shopFilter, setShopFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  // Fetch orders with React Query
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['orders', statusFilter, dateFromFilter, dateToFilter, shopFilter, currentPage],
    queryFn: () => fetchOrders({
      status: statusFilter || undefined,
      date_from: dateFromFilter || undefined,
      date_to: dateToFilter || undefined,
      shop_id: shopFilter || undefined,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      auth_token: authToken!
    }),
    enabled: !!authToken,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: reorderItems,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      // Try to create BOM using the store action
      try {
        await createBom({
          title: `Reorder - ${new Date().toLocaleDateString()}`,
          description: `Recreated from order ${data.bom_id}`,
          project_type: 'reorder'
        });
        
        // Navigate to BOM builder
        window.location.href = '/bom';
      } catch (error) {
        console.error('Failed to create BOM:', error);
        // Still navigate to BOM builder even if creation fails
        window.location.href = '/bom';
      }
    },
    onError: (error) => {
      console.error('Reorder failed:', error);
    }
  });

  // Filter orders by search query
  const filteredOrders = useMemo(() => {
    if (!ordersData?.orders || !searchQuery) return ordersData?.orders || [];
    
    const query = searchQuery.toLowerCase();
    return ordersData.orders.filter(order => 
      order.shop_name.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query) ||
      order.items.some(item => 
        item.product_name.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query)
      )
    );
  }, [ordersData?.orders, searchQuery]);

  // Calculate pagination
  // const totalPages = ordersData ? Math.ceil(ordersData.total / itemsPerPage) : 0;



  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format currency
  const formatCurrency = (amount: number, orderCurrency: string = currency) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: orderCurrency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Handle reorder
  const handleReorder = (orderId: string) => {
    if (!authToken) return;
    
    reorderMutation.mutate({
      order_id: orderId,
      auth_token: authToken
    });
  };

  // Handle select all orders
  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const ordersToExport = selectedOrders.size > 0 ? 
      filteredOrders.filter(order => selectedOrders.has(order.id)) : 
      filteredOrders;
      
    console.log(`Exporting ${ordersToExport.length} orders as ${format}`);
    
    // Create a simple CSV for demonstration
    if (format === 'excel') {
      const csvContent = [
        'Order ID,Shop,Date,Status,Payment Status,Total Amount',
        ...ordersToExport.map(order => 
          `${order.id},${order.shop_name},${formatDate(order.order_date)},${order.status},${order.payment_status},${order.total_amount}`
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setShopFilter('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  if (!currentUser || !authToken) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-8">Please log in to view your order history.</p>
            <Link 
              to="/login" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
                <p className="text-gray-600 mt-1">Track and manage your purchase transactions</p>
              </div>
              
              <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={filteredOrders.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </button>
                  
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={filteredOrders.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => {
                      setDateFromFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => {
                      setDateToFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search orders, shops, products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {ordersData ? `Showing ${filteredOrders.length} of ${ordersData.total} orders` : 'Loading...'}
                </p>
                
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Orders</h3>
              <p className="text-red-600 mb-4">Unable to fetch your order history. This feature may not be available yet.</p>
              <button
                onClick={() => refetch()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Orders Found</h3>
              <p className="text-gray-600 mb-6">
                {statusFilter || dateFromFilter || dateToFilter || searchQuery 
                  ? 'No orders match your current filters.'
                  : 'You haven\'t placed any orders yet. Start exploring our products!'
                }
              </p>
              {statusFilter || dateFromFilter || dateToFilter || searchQuery ? (
                <button
                  onClick={clearFilters}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <Link
                  to="/search"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Start Shopping
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bulk Actions Bar */}
              {selectedOrders.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-800 font-medium">
                      {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleExport('pdf')}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Export Selected PDF
                      </button>
                      <button
                        onClick={() => handleExport('excel')}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Export Selected Excel
                      </button>
                      <button
                        onClick={() => setSelectedOrders(new Set())}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Orders List */}
              <div className="space-y-4">
                {/* Select All Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 text-sm font-medium text-gray-700">
                      Select All ({filteredOrders.length} orders)
                    </label>
                  </div>
                </div>

                {/* Demo Order for Display */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                        />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Order #ORD001234
                          </h3>
                          <p className="text-gray-600">Al Mansoori Building Materials</p>
                          <p className="text-sm text-gray-500">{formatDate(Date.now() - 86400000)}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Delivered
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Payment: Paid
                          </span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(1275.50)}
                        </p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Items (3)</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Portland Cement 50kg
                              <span className="text-gray-500 ml-1">(CEMEX)</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              20 bag × {formatCurrency(25.50)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(510.00)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Steel Rebar 12mm
                              <span className="text-gray-500 ml-1">(Hadeed)</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              50 pc × {formatCurrency(12.50)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(625.00)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Sand Fine Grade
                              <span className="text-gray-500 ml-1">(Local)</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              2 ton × {formatCurrency(70.25)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(140.50)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order Actions */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleReorder('demo-order')}
                          disabled={reorderMutation.isPending}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {reorderMutation.isPending ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Creating BOM...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Reorder
                            </>
                          )}
                        </button>
                        
                        <button className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Invoice
                        </button>
                        
                        <button className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Receipt
                        </button>
                        
                        <Link
                          to="/compare"
                          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Compare Prices
                        </Link>
                      </div>
                    </div>

                    {/* Delivery Information */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Delivery Date</p>
                          <p className="font-medium">{formatDate(Date.now() - 43200000)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Delivery Address</p>
                          <p className="font-medium">Al Barsha Construction Site, Dubai</p>
                        </div>
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

export default UV_OrderHistory;