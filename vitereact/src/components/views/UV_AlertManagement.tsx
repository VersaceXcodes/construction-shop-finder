import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Bell, Plus, Search, Filter, Settings, TrendingUp, Eye, EyeOff, Edit, Trash2, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';

// Interfaces
interface Alert {
  id: string;
  user_id: string;
  type: 'price_drop' | 'stock_available' | 'new_product' | 'shop_alert';
  variant_id: string | null;
  shop_id: string | null;
  threshold_value: number | null;
  condition_type: 'below' | 'above' | 'equals' | 'percentage_change';
  notification_methods: string[];
  active: boolean;
  triggered_count: number;
  last_triggered_at: number | null;
  created_at: number;
  updated_at: number;
  product_name?: string;
  shop_name?: string;
}

interface AlertFilters {
  type: string | null;
  active: boolean | null;
}

interface NewAlertForm {
  type: 'price_drop' | 'stock_available' | 'new_product' | 'shop_alert';
  variant_id: string | null;
  shop_id: string | null;
  threshold_value: number | null;
  condition_type: 'below' | 'above' | 'equals' | 'percentage_change';
  notification_methods: string[];
}

interface ProductVariant {
  id: string;
  product_id: string;
  brand: string | null;
  grade: string | null;
  size: string | null;
  product?: {
    canonical_name: string;
    base_unit: string;
  };
}

interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours: { start: string; end: string } | null;
}

const UV_AlertManagement: React.FC = () => {
  // Store selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const notificationState = useAppStore(state => state.notification_state);
  const updateNotificationCounts = useAppStore(state => state.update_notification_counts);

  // Local state
  const [alertFilters, setAlertFilters] = useState<AlertFilters>({
    type: new URLSearchParams(window.location.search).get('type'),
    active: new URLSearchParams(window.location.search).get('active') === 'true' ? true : null
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'preferences' | 'history'>('alerts');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [newAlertForm, setNewAlertForm] = useState<NewAlertForm>({
    type: 'price_drop',
    variant_id: null,
    shop_id: null,
    threshold_value: null,
    condition_type: 'below',
    notification_methods: ['push']
  });

  const [productSearchResults, setProductSearchResults] = useState<ProductVariant[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    quiet_hours: null
  });

  const queryClient = useQueryClient();

  // API functions
  const fetchUserAlerts = async (): Promise<{ alerts: Alert[] }> => {
    const params = new URLSearchParams();
    if (alertFilters.type) params.append('type', alertFilters.type);
    if (alertFilters.active !== null) params.append('active', alertFilters.active.toString());
    params.append('limit', '50');
    params.append('offset', '0');

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/alerts?${params.toString()}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const createAlert = async (alertData: NewAlertForm): Promise<Alert> => {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/alerts`,
      alertData,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const updateAlert = async ({ alertId, updates }: { alertId: string; updates: Partial<Alert> }): Promise<Alert> => {
    const response = await axios.put(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/alerts/${alertId}`,
      updates,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const deleteAlert = async (alertId: string): Promise<void> => {
    await axios.delete(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/alerts/${alertId}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  const searchProducts = async (query: string): Promise<{ variants: ProductVariant[] }> => {
    if (!query.trim()) return { variants: [] };
    
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/product-variants?query=${encodeURIComponent(query)}&limit=10&is_active=true`
    );
    return response.data;
  };

  // React Query hooks
  const { data: alertsData, isLoading: alertsLoading, error: alertsError } = useQuery({
    queryKey: ['alerts', alertFilters],
    queryFn: fetchUserAlerts,
    enabled: !!authToken
  });

  const createAlertMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setShowCreateModal(false);
      setNewAlertForm({
        type: 'price_drop',
        variant_id: null,
        shop_id: null,
        threshold_value: null,
        condition_type: 'below',
        notification_methods: ['push']
      });
      setProductSearchResults([]);
      setProductSearchQuery('');
    }
  });

  const updateAlertMutation = useMutation({
    mutationFn: updateAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setEditingAlert(null);
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  // Product search mutation
  const { mutate: searchProductsMutation, isLoading: searchLoading } = useMutation({
    mutationFn: searchProducts,
    onSuccess: (data) => {
      setProductSearchResults(data.variants);
    }
  });

  // Effects
  useEffect(() => {
    if (productSearchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchProductsMutation(productSearchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setProductSearchResults([]);
    }
  }, [productSearchQuery, searchProductsMutation]);

  // Handlers
  const handleFilterChange = (newFilters: Partial<AlertFilters>) => {
    const updatedFilters = { ...alertFilters, ...newFilters };
    setAlertFilters(updatedFilters);
    
    // Update URL
    const params = new URLSearchParams();
    if (updatedFilters.type) params.set('type', updatedFilters.type);
    if (updatedFilters.active !== null) params.set('active', updatedFilters.active.toString());
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleCreateAlert = () => {
    createAlertMutation.mutate(newAlertForm);
  };

  const handleToggleAlert = (alert: Alert) => {
    updateAlertMutation.mutate({
      alertId: alert.id,
      updates: { active: !alert.active }
    });
  };

  const handleDeleteAlert = (alertId: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      deleteAlertMutation.mutate(alertId);
    }
  };

  const handleSelectProduct = (variant: ProductVariant) => {
    setNewAlertForm(prev => ({
      ...prev,
      variant_id: variant.id
    }));
    setShowProductSearch(false);
    setProductSearchQuery('');
    setProductSearchResults([]);
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'price_drop': return 'Price Alert';
      case 'stock_available': return 'Stock Alert';
      case 'new_product': return 'New Product Alert';
      case 'shop_alert': return 'Shop Alert';
      default: return type;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'price_drop': return <TrendingUp className="h-4 w-4" />;
      case 'stock_available': return <CheckCircle className="h-4 w-4" />;
      case 'new_product': return <Plus className="h-4 w-4" />;
      case 'shop_alert': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'below': return 'Below';
      case 'above': return 'Above';
      case 'equals': return 'Equals';
      case 'percentage_change': return '% Change';
      default: return condition;
    }
  };

  const alerts = alertsData?.alerts || [];
  const filteredAlerts = alerts.filter(alert => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        alert.product_name?.toLowerCase().includes(searchLower) ||
        alert.shop_name?.toLowerCase().includes(searchLower) ||
        getAlertTypeLabel(alert.type).toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900">Alert Management</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Monitor price changes, stock availability, and product updates
                </p>
              </div>
              <div className="mt-4 lg:mt-0 lg:ml-4 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Alert
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow-lg rounded-lg border">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Bell className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Alerts</dt>
                        <dd className="text-lg font-semibold text-gray-900">{alerts.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-lg rounded-lg border">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Alerts</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {alerts.filter(a => a.active).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-lg rounded-lg border">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Recently Triggered</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {alerts.filter(a => a.last_triggered_at && Date.now() - a.last_triggered_at < 24 * 60 * 60 * 1000).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-lg rounded-lg border">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Triggers</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {alerts.reduce((sum, alert) => sum + alert.triggered_count, 0)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'alerts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Alerts
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'preferences'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Notification Preferences
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Alert History
              </button>
            </nav>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-6 bg-white rounded-lg shadow-lg border p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Type</label>
                  <select
                    value={alertFilters.type || ''}
                    onChange={(e) => handleFilterChange({ type: e.target.value || null })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="price_drop">Price Alerts</option>
                    <option value="stock_available">Stock Alerts</option>
                    <option value="new_product">New Product Alerts</option>
                    <option value="shop_alert">Shop Alerts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={alertFilters.active === null ? '' : alertFilters.active.toString()}
                    onChange={(e) => handleFilterChange({ 
                      active: e.target.value === '' ? null : e.target.value === 'true' 
                    })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="true">Active Only</option>
                    <option value="false">Inactive Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search alerts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'alerts' && (
            <div className="bg-white shadow-lg rounded-lg border">
              {alertsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading alerts...</p>
                </div>
              ) : alertsError ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-600">Failed to load alerts</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {searchQuery || alertFilters.type || alertFilters.active !== null
                      ? 'Try adjusting your filters or search query.'
                      : 'Create your first alert to get started with price and stock monitoring.'}
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Alert
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredAlerts.map((alert) => (
                    <div key={alert.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <div className={`flex-shrink-0 p-2 rounded-lg ${
                              alert.type === 'price_drop' ? 'bg-blue-100 text-blue-600' :
                              alert.type === 'stock_available' ? 'bg-green-100 text-green-600' :
                              alert.type === 'new_product' ? 'bg-purple-100 text-purple-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {getAlertTypeIcon(alert.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-medium text-gray-900 truncate">
                                {getAlertTypeLabel(alert.type)}
                              </h3>
                              {alert.product_name && (
                                <p className="text-sm text-gray-600 truncate">
                                  Product: {alert.product_name}
                                </p>
                              )}
                              {alert.shop_name && (
                                <p className="text-sm text-gray-600 truncate">
                                  Shop: {alert.shop_name}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            {alert.threshold_value && (
                              <span className="flex items-center">
                                <TrendingUp className="h-4 w-4 mr-1" />
                                {getConditionLabel(alert.condition_type)} {alert.threshold_value}
                              </span>
                            )}
                            <span className="flex items-center">
                              <Bell className="h-4 w-4 mr-1" />
                              {alert.notification_methods.join(', ')}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {alert.triggered_count} triggers
                            </span>
                            {alert.last_triggered_at && (
                              <span className="text-orange-600">
                                Last triggered: {new Date(alert.last_triggered_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleToggleAlert(alert)}
                            disabled={updateAlertMutation.isLoading}
                            className={`p-2 rounded-lg transition-colors ${
                              alert.active
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-gray-400 hover:bg-gray-50'
                            }`}
                            title={alert.active ? 'Disable alert' : 'Enable alert'}
                          >
                            {alert.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setEditingAlert(alert)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Edit alert"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            disabled={deleteAlertMutation.isLoading}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete alert"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className={`mt-4 flex items-center justify-between p-3 rounded-lg ${
                        alert.active ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <span className={`text-sm font-medium ${
                          alert.active ? 'text-green-800' : 'text-gray-600'
                        }`}>
                          {alert.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Created {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-white shadow-lg rounded-lg border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                    <p className="text-sm text-gray-500">Receive alerts directly in your browser</p>
                  </div>
                  <button
                    onClick={() => setNotificationPreferences(prev => ({ ...prev, push_enabled: !prev.push_enabled }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      notificationPreferences.push_enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationPreferences.push_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                    <p className="text-sm text-gray-500">Receive alerts via email</p>
                  </div>
                  <button
                    onClick={() => setNotificationPreferences(prev => ({ ...prev, email_enabled: !prev.email_enabled }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      notificationPreferences.email_enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationPreferences.email_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
                    <p className="text-sm text-gray-500">Receive alerts via text message</p>
                  </div>
                  <button
                    onClick={() => setNotificationPreferences(prev => ({ ...prev, sms_enabled: !prev.sms_enabled }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      notificationPreferences.sms_enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationPreferences.sms_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Quiet Hours</h4>
                  <p className="text-sm text-gray-500 mb-4">Set hours when you don't want to receive notifications</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={notificationPreferences.quiet_hours?.start || ''}
                        onChange={(e) => setNotificationPreferences(prev => ({
                          ...prev,
                          quiet_hours: {
                            start: e.target.value,
                            end: prev.quiet_hours?.end || '08:00'
                          }
                        }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={notificationPreferences.quiet_hours?.end || ''}
                        onChange={(e) => setNotificationPreferences(prev => ({
                          ...prev,
                          quiet_hours: {
                            start: prev.quiet_hours?.start || '22:00',
                            end: e.target.value
                          }
                        }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white shadow-lg rounded-lg border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Alert History</h3>
              <p className="text-sm text-gray-500">
                View your alert trigger history and performance analytics. This feature will be available soon.
              </p>
            </div>
          )}
        </div>

        {/* Create Alert Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Create New Alert</h3>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewAlertForm({
                        type: 'price_drop',
                        variant_id: null,
                        shop_id: null,
                        threshold_value: null,
                        condition_type: 'below',
                        notification_methods: ['push']
                      });
                      setProductSearchResults([]);
                      setProductSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Type</label>
                  <select
                    value={newAlertForm.type}
                    onChange={(e) => setNewAlertForm(prev => ({ 
                      ...prev, 
                      type: e.target.value as any,
                      variant_id: null,
                      threshold_value: null
                    }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="price_drop">Price Alert</option>
                    <option value="stock_available">Stock Alert</option>
                    <option value="new_product">New Product Alert</option>
                    <option value="shop_alert">Shop Alert</option>
                  </select>
                </div>

                {(newAlertForm.type === 'price_drop' || newAlertForm.type === 'stock_available') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search for a product..."
                        value={productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value);
                          setShowProductSearch(true);
                        }}
                        onFocus={() => setShowProductSearch(true)}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      {showProductSearch && (productSearchResults.length > 0 || searchLoading) && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                          {searchLoading && (
                            <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
                          )}
                          {productSearchResults.map((variant) => (
                            <button
                              key={variant.id}
                              onClick={() => handleSelectProduct(variant)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100"
                            >
                              <div className="font-medium">{variant.product?.canonical_name}</div>
                              {variant.brand && (
                                <div className="text-gray-500">{variant.brand} {variant.grade}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {newAlertForm.variant_id && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Product selected</p>
                      </div>
                    )}
                  </div>
                )}

                {newAlertForm.type === 'price_drop' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
                      <select
                        value={newAlertForm.condition_type}
                        onChange={(e) => setNewAlertForm(prev => ({ 
                          ...prev, 
                          condition_type: e.target.value as any 
                        }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="below">Below</option>
                        <option value="above">Above</option>
                        <option value="equals">Equals</option>
                        <option value="percentage_change">Percentage Change</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Threshold Value {newAlertForm.condition_type === 'percentage_change' ? '(%)' : '(AED)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newAlertForm.threshold_value || ''}
                        onChange={(e) => setNewAlertForm(prev => ({ 
                          ...prev, 
                          threshold_value: parseFloat(e.target.value) || null 
                        }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter threshold value"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notification Methods</label>
                  <div className="space-y-2">
                    {['push', 'email', 'sms'].map((method) => (
                      <label key={method} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newAlertForm.notification_methods.includes(method)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAlertForm(prev => ({
                                ...prev,
                                notification_methods: [...prev.notification_methods, method]
                              }));
                            } else {
                              setNewAlertForm(prev => ({
                                ...prev,
                                notification_methods: prev.notification_methods.filter(m => m !== method)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900 capitalize">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAlertForm({
                      type: 'price_drop',
                      variant_id: null,
                      shop_id: null,
                      threshold_value: null,
                      condition_type: 'below',
                      notification_methods: ['push']
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAlert}
                  disabled={createAlertMutation.isLoading || !newAlertForm.notification_methods.length}
                  className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createAlertMutation.isLoading ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Alert Modal */}
        {editingAlert && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Edit Alert</h3>
                  <button
                    onClick={() => setEditingAlert(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Status</label>
                  <button
                    onClick={() => handleToggleAlert(editingAlert)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      editingAlert.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {editingAlert.active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {editingAlert.type === 'price_drop' && editingAlert.threshold_value && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Threshold Value ({editingAlert.condition_type === 'percentage_change' ? '%' : 'AED'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={editingAlert.threshold_value}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value)) {
                          updateAlertMutation.mutate({
                            alertId: editingAlert.id,
                            updates: { threshold_value: value }
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value !== editingAlert.threshold_value) {
                          updateAlertMutation.mutate({
                            alertId: editingAlert.id,
                            updates: { threshold_value: value }
                          });
                        }
                      }}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notification Methods</label>
                  <div className="space-y-2">
                    {['push', 'email', 'sms'].map((method) => (
                      <label key={method} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingAlert.notification_methods.includes(method)}
                          onChange={(e) => {
                            const newMethods = e.target.checked
                              ? [...editingAlert.notification_methods, method]
                              : editingAlert.notification_methods.filter(m => m !== method);
                            
                            updateAlertMutation.mutate({
                              alertId: editingAlert.id,
                              updates: { notification_methods: newMethods }
                            });
                          }}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900 capitalize">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setEditingAlert(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_AlertManagement;