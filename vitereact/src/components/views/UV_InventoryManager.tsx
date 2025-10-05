import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  Upload, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  DollarSign,
  BarChart3,
  RefreshCw,
  X,
  Check,
  Eye,
  Settings
} from 'lucide-react';

// Types based on Zod schemas
interface ProductVariant {
  id: string;
  product_id: string;
  brand: string | null;
  grade: string | null;
  size: string | null;
  pack_quantity: number | null;
  pack_unit: string | null;
  unit_to_base_factor: number;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  specifications: Record<string, any> | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

interface InventoryItem {
  shop_id: string;
  variant_id: string;
  in_stock: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  lead_time_days: number;
  minimum_order_quantity: number;
  maximum_order_quantity: number | null;
  updated_at: number;
}

interface PriceItem {
  id: string;
  shop_id: string;
  variant_id: string;
  price: number;
  currency: string;
  price_per_base_unit: number;
  bulk_pricing_tiers: any[] | null;
  promotional_price: number | null;
  promotion_start_date: number | null;
  promotion_end_date: number | null;
  source: string;
  verified: boolean;
  verifications_count: number;
  last_verified_at: number | null;
  created_at: number;
  updated_at: number;
}

interface InventoryResponse {
  inventory: Array<{
    shop_id: string;
    variant_id: string;
    in_stock: boolean;
    stock_quantity: number | null;
    low_stock_threshold: number | null;
    lead_time_days: number;
    minimum_order_quantity: number;
    maximum_order_quantity: number | null;
    updated_at: number;
    variant: ProductVariant;
    price: PriceItem | null;
  }>;
  total: number;
}

interface CompetitionPrice {
  shop_id: string;
  shop_name: string;
  price: number;
  distance: number;
}

interface CompetitionData {
  variant_id: string;
  shop_price: number;
  competitor_prices: CompetitionPrice[];
  price_ranking: number;
  suggested_price: number;
}

const UV_InventoryManager: React.FC = () => {
  // URL params and navigation
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Zustand state - using individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // Local state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('low_stock') === 'true');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showCompetitionAnalysis, setShowCompetitionAnalysis] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [stockValue, setStockValue] = useState('');

  const queryClient = useQueryClient();

  // Shop ID from current user
  const shopId = currentUser?.id || '';

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (categoryFilter) params.set('category', categoryFilter);
    if (lowStockFilter) params.set('low_stock', 'true');
    setSearchParams(params);
  }, [searchQuery, categoryFilter, lowStockFilter, setSearchParams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Trigger refetch when search changes
      queryClient.invalidateQueries({ queryKey: ['shop-inventory', shopId] });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, queryClient, shopId]);

  // Fetch shop inventory
  const { data: inventoryData, isLoading, error, refetch } = useQuery<InventoryResponse>({
    queryKey: ['shop-inventory', shopId, categoryFilter, lowStockFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        shop_id: shopId,
        limit: '100',
        sort_by: 'updated_at',
        sort_order: 'desc'
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter) params.append('category', categoryFilter);
      if (lowStockFilter) params.append('low_stock_only', 'true');

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory?${params}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    enabled: !!shopId && !!authToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch competition data
  const { data: competitionData, isLoading: isLoadingCompetition } = useQuery<{ comparison: CompetitionData[] }>({
    queryKey: ['price-competition', shopId],
    queryFn: async () => {
      if (!inventoryData?.inventory.length) return { comparison: [] };
      
      const variantIds = inventoryData.inventory.map(item => item.variant_id).join(',');
      const params = new URLSearchParams({
        variant_ids: variantIds,
        location_lat: currentUser?.location_lat?.toString() || '25.2048',
        location_lng: currentUser?.location_lng?.toString() || '55.2708'
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/prices/compare?${params}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    enabled: !!shopId && !!authToken && !!inventoryData?.inventory.length && showCompetitionAnalysis,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  // Update inventory mutation
  const updateInventoryMutation = useMutation({
    mutationFn: async ({ variantId, data }: { variantId: string; data: Partial<InventoryItem> }) => {
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory/${shopId}/${variantId}`,
        data,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-inventory', shopId] });
      setEditingStock(null);
      setStockValue('');
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ priceId, data }: { priceId: string; data: { price: number; price_per_base_unit: number } }) => {
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/prices/${priceId}`,
        data,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-inventory', shopId] });
      queryClient.invalidateQueries({ queryKey: ['price-competition', shopId] });
      setEditingPrice(null);
      setPriceValue('');
    },
  });

  // Remove inventory item mutation
  const removeInventoryMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory/${shopId}/${variantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-inventory', shopId] });
      setSelectedItems(prev => prev.filter(id => !prev.includes(variantId)));
    },
  });

  // Derived data
  const inventoryItems = useMemo(() => {
    if (!inventoryData?.inventory) return [];
    
    return inventoryData.inventory.map(item => ({
      ...item,
      product_catalog: item.variant,
      inventory_status: {
        shop_id: item.shop_id,
        variant_id: item.variant_id,
        in_stock: item.in_stock,
        stock_quantity: item.stock_quantity,
        low_stock_threshold: item.low_stock_threshold,
        lead_time_days: item.lead_time_days,
        minimum_order_quantity: item.minimum_order_quantity,
        maximum_order_quantity: item.maximum_order_quantity,
        updated_at: item.updated_at
      },
      pricing_data: item.price
    }));
  }, [inventoryData]);

  // Competition analysis data
  const competitionAnalysis = useMemo(() => {
    if (!competitionData?.comparison) return new Map();
    
    const analysisMap = new Map<string, CompetitionData>();
    competitionData.comparison.forEach(item => {
      analysisMap.set(item.variant_id, item);
    });
    return analysisMap;
  }, [competitionData]);

  // Handlers
  const handleSelectItem = useCallback((variantId: string) => {
    setSelectedItems(prev => 
      prev.includes(variantId) 
        ? prev.filter(id => id !== variantId)
        : [...prev, variantId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = inventoryItems.map(item => item.variant_id);
    setSelectedItems(prev => prev.length === allIds.length ? [] : allIds);
  }, [inventoryItems]);

  const handleUpdateStock = useCallback((variantId: string, quantity: number, inStock: boolean) => {
    updateInventoryMutation.mutate({
      variantId,
      data: {
        stock_quantity: quantity,
        in_stock: inStock
      }
    });
  }, [updateInventoryMutation]);

  const handleUpdatePrice = useCallback((priceId: string, price: number, unitFactor: number) => {
    updatePriceMutation.mutate({
      priceId,
      data: {
        price,
        price_per_base_unit: price / unitFactor
      }
    });
  }, [updatePriceMutation]);

  const handleRemoveItem = useCallback((variantId: string) => {
    if (window.confirm('Are you sure you want to remove this item from your inventory?')) {
      removeInventoryMutation.mutate(variantId);
    }
  }, [removeInventoryMutation]);

  const handleBulkDelete = useCallback(() => {
    if (selectedItems.length === 0) return;
    
    if (window.confirm(`Are you sure you want to remove ${selectedItems.length} items from your inventory?`)) {
      selectedItems.forEach(variantId => {
        removeInventoryMutation.mutate(variantId);
      });
    }
  }, [selectedItems, removeInventoryMutation]);

  // Stats
  const stats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const inStockItems = inventoryItems.filter(item => item.in_stock).length;
    const lowStockItems = inventoryItems.filter(item => 
      item.stock_quantity !== null && 
      item.low_stock_threshold !== null && 
      item.stock_quantity <= item.low_stock_threshold
    ).length;
    const outOfStockItems = inventoryItems.filter(item => !item.in_stock).length;

    return { totalItems, inStockItems, lowStockItems, outOfStockItems };
  }, [inventoryItems]);

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Inventory</h2>
            <p className="text-gray-600 mb-4">Failed to load your inventory data.</p>
            <button 
              onClick={() => refetch()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Inventory Manager</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your product catalog, stock levels, and pricing
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowCompetitionAnalysis(!showCompetitionAnalysis)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showCompetitionAnalysis 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Competition Analysis
                </button>
                <button className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </button>
                <button className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
                <Link
                  to="/shop/inventory/add"
                  className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">In Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inStockItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <X className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Out of Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.outOfStockItems}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex-1 max-w-lg">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products by name, SKU, or barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-4 mt-4 md:mt-0">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    <option value="cement">Cement</option>
                    <option value="steel">Steel</option>
                    <option value="concrete">Concrete</option>
                    <option value="tools">Tools</option>
                  </select>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={lowStockFilter}
                      onChange={(e) => setLowStockFilter(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Low Stock Only</span>
                  </label>
                  <button
                    onClick={() => refetch()}
                    className="flex items-center text-gray-600 hover:text-gray-900"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedItems.length > 0 && (
              <div className="px-6 py-3 bg-blue-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">
                    {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleBulkDelete}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Delete Selected
                    </button>
                    <button
                      onClick={() => setSelectedItems([])}
                      className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === inventoryItems.length && inventoryItems.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    {showCompetitionAnalysis && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Competition
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryItems.map((item) => {
                    const variant = item.product_catalog;
                    const inventory = item.inventory_status;
                    const price = item.pricing_data;
                    const competition = competitionAnalysis.get(variant.id);
                    const isSelected = selectedItems.includes(variant.id);
                    const isLowStock = inventory.stock_quantity !== null && 
                                     inventory.low_stock_threshold !== null && 
                                     inventory.stock_quantity <= inventory.low_stock_threshold;

                    return (
                      <tr key={variant.id} className={isSelected ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectItem(variant.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-12 w-12 bg-gray-200 rounded-lg mr-4 flex items-center justify-center">
                              {variant.image_url ? (
                                <img 
                                  src={variant.image_url} 
                                  alt={variant.brand || 'Product'}
                                  className="h-12 w-12 rounded-lg object-cover"
                                />
                              ) : (
                                <Package className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {variant.brand} {variant.grade} {variant.size}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {variant.sku || 'N/A'}
                              </div>
                              {variant.pack_quantity && (
                                <div className="text-xs text-gray-400">
                                  {variant.pack_quantity} {variant.pack_unit}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingStock === variant.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={stockValue}
                                onChange={(e) => setStockValue(e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  const quantity = parseInt(stockValue);
                                  if (!isNaN(quantity)) {
                                    handleUpdateStock(variant.id, quantity, quantity > 0);
                                  }
                                }}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStock(null);
                                  setStockValue('');
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                                {inventory.stock_quantity || 0}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingStock(variant.id);
                                  setStockValue((inventory.stock_quantity || 0).toString());
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          {isLowStock && (
                            <div className="text-xs text-red-500 mt-1">Low Stock</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {price ? (
                            editingPrice === price.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={priceValue}
                                  onChange={(e) => setPriceValue(e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    const newPrice = parseFloat(priceValue);
                                    if (!isNaN(newPrice)) {
                                      handleUpdatePrice(price.id, newPrice, variant.unit_to_base_factor);
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPrice(null);
                                    setPriceValue('');
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-900">
                                  {price.currency} {price.price.toFixed(2)}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingPrice(price.id);
                                    setPriceValue(price.price.toString());
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-sm text-gray-500">No price set</span>
                          )}
                        </td>
                        {showCompetitionAnalysis && (
                          <td className="px-6 py-4">
                            {competition ? (
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  competition.price_ranking <= 2 
                                    ? 'bg-green-100 text-green-800' 
                                    : competition.price_ranking <= 4
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Rank #{competition.price_ranking}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Suggested: {price?.currency} {competition.suggested_price.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              isLoadingCompetition ? (
                                <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full"></div>
                              ) : (
                                <span className="text-xs text-gray-400">No data</span>
                              )
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inventory.in_stock 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {inventory.in_stock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {/* View details */}}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {/* Edit product */}}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(variant.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {inventoryItems.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || categoryFilter || lowStockFilter 
                    ? 'Try adjusting your search filters.' 
                    : 'Start by adding products to your inventory.'
                  }
                </p>
                <Link
                  to="/shop/inventory/add"
                  className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Product
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_InventoryManager;