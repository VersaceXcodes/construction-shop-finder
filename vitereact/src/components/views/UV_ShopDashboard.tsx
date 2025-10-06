import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  TrendingUpIcon, 
  AlertTriangleIcon,
  MessageSquareIcon,
  ShoppingCartIcon,
  UsersIcon,
  DollarSignIcon,
  PackageIcon,
  ClockIcon,
  SettingsIcon,
  RefreshCwIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon
} from 'lucide-react';

// TypeScript Interfaces
interface ShopProfile {
  id: string;
  user_id: string;
  name: string;
  phones: string[];
  location_lat: number;
  location_lng: number;
  address: string;
  hours: Record<string, any> | null;
  verified: boolean;
  business_license: string | null;
  shop_type: string | null;
  delivery_available: boolean;
  delivery_radius: number | null;
  delivery_fee_base: number | null;
  delivery_fee_per_km: number | null;
  minimum_order: number | null;
  cash_discount_percentage: number | null;
  rating_average: number;
  rating_count: number;
  response_time_hours: number | null;
  stock_accuracy_score: number;
  created_at: number;
  updated_at: number;
}

interface RFQ {
  id: string;
  user_id: string;
  bom_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: number | null;
  delivery_location_lat: number | null;
  delivery_location_lng: number | null;
  delivery_address: string | null;
  special_requirements: string | null;
  budget_limit: number | null;
  responses_count: number;
  created_at: number;
  updated_at: number;
}

interface InventoryAlert {
  variant_id: string;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  alert_type: string;
  severity: string;
}

interface CustomerMessage {
  message_id: string;
  rfq_id: string;
  customer_name: string;
  message_preview: string;
  created_at: number;
  is_urgent: boolean;
}

interface PerformanceMetrics {
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  customers: {
    new_count: number;
    repeat_count: number;
    satisfaction_score: number;
  };
  sales: {
    total_orders: number;
    conversion_rate: number;
    average_order_value: number;
  };
  competition: {
    price_position: string;
    market_share: number;
  };
}

const UV_ShopDashboard: React.FC = () => {
  // Global state access with individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  // const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  
  const queryClient = useQueryClient();

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Shop Profile Query
  const { data: shopProfile, isLoading: isLoadingShop, error: shopError } = useQuery<ShopProfile>({
    queryKey: ['shop-profile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !authToken) {
        throw new Error('Authentication required');
      }

      // For shop owner, find their shop first
      const shopsResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { user_id: currentUser.id, limit: 1 }
        }
      );

      if (!shopsResponse.data.shops || shopsResponse.data.shops.length === 0) {
        throw new Error('No shop found for user');
      }

      const shopId = shopsResponse.data.shops[0].id;

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/${shopId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      return response.data;
    },
    enabled: !!currentUser?.id && !!authToken,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1
  });

  // Pending RFQs Query
  const { data: pendingRFQs = [], isLoading: isLoadingRFQs } = useQuery<RFQ[]>({
    queryKey: ['pending-rfqs', shopProfile?.id],
    queryFn: async () => {
      if (!shopProfile || !authToken) return [];

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/rfqs`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            status: 'pending',
            limit: 10,
            sort_by: 'deadline',
            sort_order: 'asc'
          }
        }
      );

      // Filter RFQs within delivery radius
      return response.data.rfqs?.filter((rfq: RFQ) => {
        if (!rfq.delivery_location_lat || !rfq.delivery_location_lng || !shopProfile.delivery_radius) {
          return true; // Include if no location data
        }
        
        const distance = calculateDistance(
          rfq.delivery_location_lat,
          rfq.delivery_location_lng,
          shopProfile.location_lat,
          shopProfile.location_lng
        );
        
        return distance <= shopProfile.delivery_radius;
      }) || [];
    },
    enabled: !!shopProfile?.id && !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Inventory Alerts Query
  const { data: inventoryAlerts = [], isLoading: isLoadingAlerts } = useQuery<InventoryAlert[]>({
    queryKey: ['inventory-alerts', shopProfile?.id],
    queryFn: async () => {
      if (!shopProfile || !authToken) return [];

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            shop_id: shopProfile.id,
            low_stock_only: true,
            limit: 20
          }
        }
      );

      return response.data.inventory?.map((item: any) => ({
        variant_id: item.variant_id,
        product_name: item.variant?.product?.canonical_name || 'Unknown Product',
        current_stock: item.stock_quantity || 0,
        low_stock_threshold: item.low_stock_threshold || 0,
        alert_type: item.stock_quantity === 0 ? 'out_of_stock' : 'low_stock',
        severity: item.stock_quantity === 0 ? 'critical' : 'warning'
      })) || [];
    },
    enabled: !!shopProfile?.id && !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Customer Messages Query (aggregated from RFQs)
  const { data: customerMessages = [], isLoading: isLoadingMessages } = useQuery<CustomerMessage[]>({
    queryKey: ['customer-messages', pendingRFQs],
    queryFn: async () => {
      if (!pendingRFQs.length || !authToken) return [];

      const messagePromises = pendingRFQs.slice(0, 5).map(async (rfq) => {
        try {
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/rfqs/${rfq.id}/messages`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
              params: { limit: 50, offset: 0 }
            }
          );

          return response.data.messages?.filter((msg: any) => 
            !msg.read_at && msg.sender_id !== currentUser?.id
          ).map((msg: any) => ({
            message_id: msg.id,
            rfq_id: msg.rfq_id,
            customer_name: msg.sender?.name || 'Unknown Customer',
            message_preview: msg.message.substring(0, 100),
            created_at: msg.created_at,
            is_urgent: rfq.priority === 'urgent' || rfq.priority === 'high'
          })) || [];
        } catch (error) {
          console.warn(`Failed to fetch messages for RFQ ${rfq.id}:`, error);
          return [];
        }
      });

      const messageArrays = await Promise.all(messagePromises);
      return messageArrays.flat();
    },
    enabled: !!pendingRFQs.length && !!authToken,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1
  });

  // Mock performance metrics (since endpoint is missing)
  const performanceMetrics: PerformanceMetrics = {
    revenue: {
      daily: 1250.80,
      weekly: 8750.60,
      monthly: 35890.25,
      yearly: 425000.00
    },
    customers: {
      new_count: 15,
      repeat_count: 45,
      satisfaction_score: 4.2
    },
    sales: {
      total_orders: 128,
      conversion_rate: 0.68,
      average_order_value: 280.15
    },
    competition: {
      price_position: 'competitive',
      market_share: 0.12
    }
  };

  // Refresh all data
  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['shop-profile'] });
    queryClient.invalidateQueries({ queryKey: ['pending-rfqs'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['customer-messages'] });
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get priority color
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get severity color for alerts
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  if (isLoadingShop) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <RefreshCwIcon className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading shop dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  if (shopError || !shopProfile) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Shop Not Found</h2>
            <p className="text-gray-600 mb-4">
              Unable to load shop information. Please ensure you have a shop profile.
            </p>
            <Link
              to="/shop/settings"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Shop Profile
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shop Dashboard</h1>
                <p className="mt-1 text-gray-600">
                  Welcome back, {shopProfile.name}
                  {shopProfile.verified && (
                    <CheckCircleIcon className="inline-block h-5 w-5 text-green-500 ml-2" />
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={refreshDashboard}
                  className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <Link
                  to="/shop/settings"
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </div>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Revenue Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(performanceMetrics.revenue.monthly)}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+12.5% from last month</span>
                  </div>
                </div>
                <DollarSignIcon className="h-12 w-12 text-blue-600 bg-blue-100 p-3 rounded-full" />
              </div>
            </div>

            {/* Orders Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performanceMetrics.sales.total_orders}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+8.2% this month</span>
                  </div>
                </div>
                <ShoppingCartIcon className="h-12 w-12 text-green-600 bg-green-100 p-3 rounded-full" />
              </div>
            </div>

            {/* Customers Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Customers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performanceMetrics.customers.new_count + performanceMetrics.customers.repeat_count}
                  </p>
                  <div className="flex items-center mt-2">
                    <span className="text-sm text-gray-600">
                      {performanceMetrics.customers.new_count} new, {performanceMetrics.customers.repeat_count} returning
                    </span>
                  </div>
                </div>
                <UsersIcon className="h-12 w-12 text-purple-600 bg-purple-100 p-3 rounded-full" />
              </div>
            </div>

            {/* Conversion Rate Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(performanceMetrics.sales.conversion_rate * 100).toFixed(1)}%
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Above average</span>
                  </div>
                </div>
                <TrendingUpIcon className="h-12 w-12 text-orange-600 bg-orange-100 p-3 rounded-full" />
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - RFQs and Inventory */}
            <div className="lg:col-span-2 space-y-8">
              {/* Pending RFQs */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Pending RFQs</h2>
                    <Link
                      to="/rfq"
                      className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingRFQs ? (
                    <div className="text-center py-8">
                      <RefreshCwIcon className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-500">Loading RFQs...</p>
                    </div>
                  ) : pendingRFQs.length > 0 ? (
                    <div className="space-y-4">
                      {pendingRFQs.slice(0, 5).map((rfq) => (
                        <div key={rfq.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{rfq.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {rfq.delivery_address || 'No delivery address specified'}
                            </p>
                            <div className="flex items-center mt-2 space-x-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(rfq.priority)}`}>
                                {rfq.priority}
                              </span>
                              {rfq.deadline && (
                                <span className="flex items-center text-xs text-gray-500">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  Due {formatDate(rfq.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Link
                            to={`/rfq?rfq_id=${rfq.id}`}
                            className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Respond
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquareIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No pending RFQs</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory Alerts */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Inventory Alerts</h2>
                    <Link
                      to="/shop/inventory?low_stock=true"
                      className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Manage Inventory
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingAlerts ? (
                    <div className="text-center py-8">
                      <RefreshCwIcon className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-500">Loading alerts...</p>
                    </div>
                  ) : inventoryAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {inventoryAlerts.slice(0, 8).map((alert) => (
                        <div key={alert.variant_id} className={`flex items-center justify-between p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                          <div className="flex items-center">
                            <AlertTriangleIcon className="h-5 w-5 mr-3" />
                            <div>
                              <p className="font-medium">{alert.product_name}</p>
                              <p className="text-sm opacity-75">
                                Stock: {alert.current_stock} / Threshold: {alert.low_stock_threshold}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-medium uppercase tracking-wider">
                            {alert.alert_type.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <PackageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No inventory alerts</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Messages and Quick Actions */}
            <div className="space-y-8">
              {/* Customer Messages */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Messages</h2>
                </div>
                <div className="p-6">
                  {isLoadingMessages ? (
                    <div className="text-center py-8">
                      <RefreshCwIcon className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-500">Loading messages...</p>
                    </div>
                  ) : customerMessages.length > 0 ? (
                    <div className="space-y-4">
                      {customerMessages.slice(0, 5).map((message) => (
                        <div key={message.message_id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{message.customer_name}</p>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {message.message_preview}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {formatDate(message.created_at)}
                              </p>
                            </div>
                            {message.is_urgent && (
                              <span className="ml-2 inline-flex items-center px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquareIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No recent messages</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div className="p-6 space-y-3">
                  <Link
                    to="/shop/inventory"
                    className="flex items-center w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <PackageIcon className="h-5 w-5 text-gray-600 mr-3" />
                    <span className="font-medium text-gray-900">Manage Inventory</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>
                  
                  <Link
                    to="/rfq"
                    className="flex items-center w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <MessageSquareIcon className="h-5 w-5 text-gray-600 mr-3" />
                    <span className="font-medium text-gray-900">View All RFQs</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>

                  <Link
                    to="/shop/analytics"
                    className="flex items-center w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <TrendingUpIcon className="h-5 w-5 text-gray-600 mr-3" />
                    <span className="font-medium text-gray-900">View Analytics</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>

                  <Link
                    to="/shop/settings"
                    className="flex items-center w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <SettingsIcon className="h-5 w-5 text-gray-600 mr-3" />
                    <span className="font-medium text-gray-900">Shop Settings</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>
                </div>
              </div>

              {/* Shop Status */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Shop Status</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Verification Status</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shopProfile.verified 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shopProfile.verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Rating</span>
                    <span className="font-medium text-gray-900">
                      {shopProfile.rating_average.toFixed(1)}/5.0 ({shopProfile.rating_count} reviews)
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-medium text-gray-900">
                      {shopProfile.response_time_hours ? `${shopProfile.response_time_hours}h` : 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Stock Accuracy</span>
                    <span className="font-medium text-gray-900">
                      {shopProfile.stock_accuracy_score}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ShopDashboard;