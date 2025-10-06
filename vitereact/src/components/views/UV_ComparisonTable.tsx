import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  ShoppingCartIcon, 
  DocumentPlusIcon, 
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import { 
  ChartBarIcon as ChartBarIconSolid 
} from '@heroicons/react/24/solid';

// Types
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

interface Shop {
  id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  verified: boolean;
  rating_average: number;
  delivery_available: boolean;
  delivery_fee_base: number | null;
  delivery_fee_per_km: number | null;
}

interface Price {
  id: string;
  shop_id: string;
  variant_id: string;
  price: number;
  currency: string;
  price_per_base_unit: number;
  bulk_pricing_tiers: Array<{ min_qty: number; price: number }> | null;
  promotional_price: number | null;
  promotion_start_date: number | null;
  promotion_end_date: number | null;
  verified: boolean;
  verifications_count: number;
  last_verified_at: number | null;
}

interface Inventory {
  shop_id: string;
  variant_id: string;
  in_stock: boolean;
  stock_quantity: number | null;
  lead_time_days: number;
  minimum_order_quantity: number;
  maximum_order_quantity: number | null;
}

interface ComparisonData {
  variant: ProductVariant;
  product: {
    canonical_name: string;
    base_unit: string;
  };
  shop_prices: Array<{
    shop: Shop;
    price: Price;
    inventory: Inventory;
    total_price: number;
    delivery_fee: number;
    distance_km: number | null;
  }>;
}

interface OptimizationResults {
  cheapest_single_shop: {
    shop_id: string;
    total_cost: number;
  } | null;
  optimized_multi_shop: Array<{
    shop_id: string;
    items: Array<{ variant_id: string; quantity: number; price: number }>;
    subtotal: number;
  }>;
  total_savings: number;
}

interface ComparisonResponse {
  comparison: ComparisonData[];
  optimization: OptimizationResults;
}

const UV_ComparisonTable: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state (individual selectors to avoid infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentBOM = useAppStore(state => state.current_bom);
  const userLocation = useAppStore(state => state.user_location);
  // const addToBOMAction = useAppStore(state => state.add_bom_item);

  // Local state
  const [comparisonVariants, setComparisonVariants] = useState<string[]>([]);
  const [pinnedShops, setPinnedShops] = useState<string[]>([]);
  const [quantitySettings, setQuantitySettings] = useState<Record<string, number>>({});
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [wasteFactors, setWasteFactors] = useState<Record<string, number>>({});
  const [showOptimization, setShowOptimization] = useState(false);

  // Parse URL parameters
  useEffect(() => {
    const productIds = searchParams.get('product_ids');
    const shopIds = searchParams.get('shop_ids');
    const quantity = searchParams.get('quantity');
    const includeDeliveryParam = searchParams.get('include_delivery');
    const wasteFactor = searchParams.get('waste_factor');

    if (productIds) {
      const variants = productIds.split(',').filter(Boolean);
      setComparisonVariants(variants);
      
      // Initialize quantity settings
      const defaultQuantity = quantity ? parseFloat(quantity) : 1;
      const quantities: Record<string, number> = {};
      variants.forEach(variantId => {
        quantities[variantId] = defaultQuantity;
      });
      setQuantitySettings(quantities);

      // Initialize waste factors
      if (wasteFactor) {
        const wasteValue = parseFloat(wasteFactor);
        const wasteFactorsObj: Record<string, number> = {};
        variants.forEach(variantId => {
          wasteFactorsObj[variantId] = wasteValue;
        });
        setWasteFactors(wasteFactorsObj);
      }
    }

    if (shopIds) {
      setPinnedShops(shopIds.split(',').filter(Boolean));
    }

    setIncludeDelivery(includeDeliveryParam === 'true');
  }, [searchParams]);

  // Fetch comparison data
  const {
    data: comparisonData,
    isLoading,
    error,
    refetch
  } = useQuery<ComparisonResponse>({
    queryKey: [
      'comparison', 
      comparisonVariants, 
      pinnedShops, 
      quantitySettings, 
      includeDelivery, 
      wasteFactors,
      userLocation?.coordinates
    ],
    queryFn: async () => {
      if (comparisonVariants.length === 0) {
        return { comparison: [], optimization: { cheapest_single_shop: null, optimized_multi_shop: [], total_savings: 0 } };
      }

      const params = new URLSearchParams();
      params.append('variant_ids', comparisonVariants.join(','));
      
      if (pinnedShops.length > 0) {
        params.append('shop_ids', pinnedShops.join(','));
      }

      // Use the first variant's quantity as default, or 1
      const defaultQuantity = Object.values(quantitySettings)[0] || 1;
      params.append('quantity', defaultQuantity.toString());
      
      params.append('include_delivery', includeDelivery.toString());
      
      const defaultWasteFactor = Object.values(wasteFactors)[0] || 0;
      if (defaultWasteFactor > 0) {
        params.append('waste_factor', defaultWasteFactor.toString());
      }

      if (userLocation?.coordinates) {
        params.append('location_lat', userLocation.coordinates.lat.toString());
        params.append('location_lng', userLocation.coordinates.lng.toString());
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/prices/compare?${params}`,
        authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}
      );

      return response.data;
    },
    enabled: comparisonVariants.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Add to BOM mutation
  const addToBOMMutation = useMutation({
    mutationFn: async ({ variantId, quantity, unit, wasteFactor }: {
      variantId: string;
      quantity: number;
      unit: string;
      wasteFactor: number;
    }) => {
      if (!currentBOM.id || !authToken) {
        throw new Error('No active BOM or authentication required');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${currentBOM.id}/items`,
        {
          variant_id: variantId,
          quantity,
          unit,
          waste_factor: wasteFactor,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', currentBOM.id] });
    }
  });

  // Send RFQ mutation
  const sendRFQMutation = useMutation({
    mutationFn: async ({ title, description, priority }: {
      title: string;
      description: string;
      priority: string;
    }) => {
      if (!currentBOM.id || !authToken) {
        throw new Error('No active BOM or authentication required');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/rfqs`,
        {
          bom_id: currentBOM.id,
          title,
          description,
          priority,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
    }
  });

  // Update quantity handler
  const updateQuantity = useCallback((variantId: string, newQuantity: number) => {
    setQuantitySettings(prev => ({
      ...prev,
      [variantId]: Math.max(1, newQuantity)
    }));
  }, []);

  // Update waste factor handler
  const updateWasteFactor = useCallback((variantId: string, wasteFactor: number) => {
    setWasteFactors(prev => ({
      ...prev,
      [variantId]: Math.max(0, Math.min(100, wasteFactor))
    }));
  }, []);

  // Pin/unpin shop handler
  const toggleShopPin = useCallback((shopId: string) => {
    setPinnedShops(prev => 
      prev.includes(shopId) 
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId]
    );
  }, []);

  // Get unique shops from comparison data
  const uniqueShops = useMemo(() => {
    if (!comparisonData?.comparison) return [];
    
    const shopsMap = new Map<string, Shop>();
    comparisonData.comparison.forEach(item => {
      item.shop_prices.forEach(shopPrice => {
        shopsMap.set(shopPrice.shop.id, shopPrice.shop);
      });
    });
    
    return Array.from(shopsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [comparisonData]);

  // Calculate best prices for visual highlighting
  const bestPrices = useMemo(() => {
    if (!comparisonData?.comparison) return new Map();
    
    const bestPricesMap = new Map<string, number>();
    comparisonData.comparison.forEach(item => {
      const variantId = item.variant.id;
      const inStockPrices = item.shop_prices
        .filter(sp => sp.inventory.in_stock)
        .map(sp => sp.total_price);
      
      if (inStockPrices.length > 0) {
        bestPricesMap.set(variantId, Math.min(...inStockPrices));
      }
    });
    
    return bestPricesMap;
  }, [comparisonData]);

  // Handle add to BOM
  const handleAddToBOM = async (variantId: string) => {
    try {
      const variant = comparisonData?.comparison.find(item => item.variant.id === variantId)?.variant;
      if (!variant) return;

      await addToBOMMutation.mutateAsync({
        variantId,
        quantity: quantitySettings[variantId] || 1,
        unit: variant.pack_unit || 'piece',
        wasteFactor: wasteFactors[variantId] || 0,
      });
    } catch (error) {
      console.error('Failed to add to BOM:', error);
    }
  };

  // Handle send RFQ
  const handleSendRFQ = async () => {
    try {
      await sendRFQMutation.mutateAsync({
        title: `RFQ for Comparison Items - ${new Date().toLocaleDateString()}`,
        description: `Request for quote including ${comparisonVariants.length} products from comparison table.`,
        priority: 'medium',
      });
    } catch (error) {
      console.error('Failed to send RFQ:', error);
    }
  };

  // Get price cell style based on performance
  const getPriceCellStyle = (variantId: string, totalPrice: number, inStock: boolean) => {
    if (!inStock) {
      return 'bg-red-50 text-red-900 border-red-200';
    }
    
    const bestPrice = bestPrices.get(variantId);
    if (bestPrice && totalPrice === bestPrice) {
      return 'bg-green-50 text-green-900 border-green-200';
    }
    
    if (bestPrice && totalPrice > bestPrice * 1.2) {
      return 'bg-amber-50 text-amber-900 border-amber-200';
    }
    
    return 'bg-white text-gray-900 border-gray-200';
  };

  if (comparisonVariants.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No products to compare</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start by adding products to your comparison from the search results.
            </p>
            <div className="mt-6">
              <Link
                to="/search"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ShoppingCartIcon className="-ml-1 mr-2 h-5 w-5" />
                Browse Products
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
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Price Comparison</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Comparing {comparisonVariants.length} products across {uniqueShops.length} shops
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowOptimization(!showOptimization)}
                  className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium ${
                    showOptimization
                      ? 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                      : 'text-gray-700 bg-white hover:bg-gray-50'
                  } border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                >
                  {showOptimization ? <ChartBarIconSolid className="h-5 w-5 mr-2" /> : <ChartBarIcon className="h-5 w-5 mr-2" />}
                  Optimization
                </button>
                
                <button
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-5 w-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <TruckIcon className="h-5 w-5 text-gray-400 mr-2" />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeDelivery}
                    onChange={(e) => setIncludeDelivery(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include delivery costs</span>
                </label>
              </div>
              
              {currentBOM.id && (
                <div className="flex items-center space-x-2">
                  <DocumentPlusIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-700">Active BOM:</span>
                  <span className="text-sm font-medium text-blue-600">{currentBOM.title}</span>
                </div>
              )}
              
              {currentUser && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSendRFQ}
                    disabled={sendRFQMutation.isPending || !currentBOM.id}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                    Send RFQ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Optimization Panel */}
        {showOptimization && comparisonData?.optimization && (
          <div className="bg-blue-50 border-b border-blue-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Purchase Optimization</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {comparisonData.optimization.cheapest_single_shop && (
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-medium text-gray-900 mb-2">Cheapest Single Shop</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {comparisonData.optimization.cheapest_single_shop.total_cost.toFixed(2)} AED
                    </div>
                    <p className="text-sm text-gray-600">
                      Shop ID: {comparisonData.optimization.cheapest_single_shop.shop_id}
                    </p>
                  </div>
                )}
                
                {comparisonData.optimization.total_savings > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-medium text-gray-900 mb-2">Multi-Shop Savings</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {comparisonData.optimization.total_savings.toFixed(2)} AED
                    </div>
                    <p className="text-sm text-gray-600">
                      Potential savings with multi-shop strategy
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading comparison data...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error loading comparison data
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error instanceof Error ? error.message : 'An unexpected error occurred'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                          Product
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Waste %
                        </th>
                        {uniqueShops.map((shop) => (
                          <th key={shop.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => toggleShopPin(shop.id)}
                                className={`p-1 rounded ${
                                  pinnedShops.includes(shop.id)
                                    ? 'text-blue-600 hover:text-blue-700'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                              {pinnedShops.includes(shop.id) ? (
                                <span className="h-4 w-4">📌</span>
                              ) : (
                                <span className="h-4 w-4" />
                              )}
                              </button>
                              <div>
                                <div className="font-medium text-gray-900">{shop.name}</div>
                                <div className="flex items-center justify-center text-xs text-gray-500">
                                  {shop.verified && (
                                    <CheckCircleIcon className="h-3 w-3 text-green-500 mr-1" />
                                  )}
                                  ★ {shop.rating_average.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonData?.comparison.map((item) => (
                        <tr key={item.variant.id} className="hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-6 py-4 border-r border-gray-200">
                            <div className="flex items-center">
                              {item.variant.image_url && (
                                <img
                                  className="h-10 w-10 rounded-lg object-cover mr-3"
                                  src={item.variant.image_url}
                                  alt={item.product.canonical_name}
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {item.product.canonical_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {item.variant.brand && `${item.variant.brand} • `}
                                  {item.variant.grade && `${item.variant.grade} • `}
                                  {item.variant.size}
                                </div>
                                {item.variant.pack_quantity && (
                                  <div className="text-xs text-gray-400">
                                    {item.variant.pack_quantity} {item.variant.pack_unit}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-3 py-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={quantitySettings[item.variant.id] || 1}
                                onChange={(e) => updateQuantity(item.variant.id, parseFloat(e.target.value) || 1)}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <span className="text-xs text-gray-500">{item.variant.pack_unit || 'pcs'}</span>
                            </div>
                          </td>
                          
                          <td className="px-3 py-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={wasteFactors[item.variant.id] || 0}
                                onChange={(e) => updateWasteFactor(item.variant.id, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <ScaleIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          </td>
                          
                          {uniqueShops.map((shop) => {
                            const shopPrice = item.shop_prices.find(sp => sp.shop.id === shop.id);
                            
                            if (!shopPrice) {
                              return (
                                <td key={shop.id} className="px-3 py-4 text-center">
                                  <div className="text-sm text-gray-400">Not available</div>
                                </td>
                              );
                            }
                            
                            const adjustedQuantity = (quantitySettings[item.variant.id] || 1) * (1 + (wasteFactors[item.variant.id] || 0) / 100);
                            const totalPrice = shopPrice.price.price_per_base_unit * adjustedQuantity + (includeDelivery ? shopPrice.delivery_fee : 0);
                            
                            return (
                              <td key={shop.id} className="px-3 py-4">
                                <div className={`p-3 rounded-lg border ${getPriceCellStyle(item.variant.id, totalPrice, shopPrice.inventory.in_stock)}`}>
                                  <div className="text-lg font-semibold">
                                    {totalPrice.toFixed(2)} AED
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {shopPrice.price.price_per_base_unit.toFixed(2)} AED/unit
                                  </div>
                                  {includeDelivery && shopPrice.delivery_fee > 0 && (
                                    <div className="text-xs text-gray-500">
                                      +{shopPrice.delivery_fee.toFixed(2)} delivery
                                    </div>
                                  )}
                                  <div className="mt-1 flex items-center justify-center">
                                    {shopPrice.inventory.in_stock ? (
                                      <div className="flex items-center text-green-600">
                                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                                        <span className="text-xs">In Stock</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center text-red-600">
                                        <XCircleIcon className="h-3 w-3 mr-1" />
                                        <span className="text-xs">Out of Stock</span>
                                      </div>
                                    )}
                                  </div>
                                  {shopPrice.inventory.lead_time_days > 0 && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {shopPrice.inventory.lead_time_days} days lead time
                                    </div>
                                  )}
                                  {shopPrice.price.promotional_price && (
                                    <div className="text-xs text-orange-600 mt-1">
                                      Promotion: {shopPrice.price.promotional_price.toFixed(2)} AED
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          
                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-2">
                              {currentBOM.id && (
                                <button
                                  onClick={() => handleAddToBOM(item.variant.id)}
                                  disabled={addToBOMMutation.isPending}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                >
                                  <DocumentPlusIcon className="h-3 w-3 mr-1" />
                                  Add to BOM
                                </button>
                              )}
                              <Link
                                to={`/product/${item.variant.product_id}`}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                View Details
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-6">
                {comparisonData?.comparison.map((item) => (
                  <div key={item.variant.id} className="bg-white rounded-lg shadow">
                    {/* Product Header */}
                    <div className="px-4 py-4 border-b border-gray-200">
                      <div className="flex items-center">
                        {item.variant.image_url && (
                          <img
                            className="h-12 w-12 rounded-lg object-cover mr-3"
                            src={item.variant.image_url}
                            alt={item.product.canonical_name}
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {item.product.canonical_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {item.variant.brand && `${item.variant.brand} • `}
                            {item.variant.grade && `${item.variant.grade} • `}
                            {item.variant.size}
                          </p>
                        </div>
                      </div>
                      
                      {/* Quantity and Waste Factor Controls */}
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={quantitySettings[item.variant.id] || 1}
                              onChange={(e) => updateQuantity(item.variant.id, parseFloat(e.target.value) || 1)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-sm text-gray-500">{item.variant.pack_unit || 'pcs'}</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Waste %
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={wasteFactors[item.variant.id] || 0}
                            onChange={(e) => updateWasteFactor(item.variant.id, parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Shop Prices */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {item.shop_prices.map((shopPrice) => {
                          const adjustedQuantity = (quantitySettings[item.variant.id] || 1) * (1 + (wasteFactors[item.variant.id] || 0) / 100);
                          const totalPrice = shopPrice.price.price_per_base_unit * adjustedQuantity + (includeDelivery ? shopPrice.delivery_fee : 0);
                          
                          return (
                            <div key={shopPrice.shop.id} className={`p-3 rounded-lg border ${getPriceCellStyle(item.variant.id, totalPrice, shopPrice.inventory.in_stock)}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center">
                                    <span className="font-medium text-gray-900">{shopPrice.shop.name}</span>
                                    {shopPrice.shop.verified && (
                                      <CheckCircleIcon className="h-4 w-4 text-green-500 ml-1" />
                                    )}
                                    <button
                                      onClick={() => toggleShopPin(shopPrice.shop.id)}
                                      className={`ml-2 p-1 rounded ${
                                        pinnedShops.includes(shopPrice.shop.id)
                                          ? 'text-blue-600 hover:text-blue-700'
                                          : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    >
                                      {pinnedShops.includes(shopPrice.shop.id) ? (
                                        <span className="h-4 w-4">📌</span>
                                      ) : (
                                        <span className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ★ {shopPrice.shop.rating_average.toFixed(1)}
                                    {shopPrice.distance_km && ` • ${shopPrice.distance_km.toFixed(1)} km`}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-gray-900">
                                    {totalPrice.toFixed(2)} AED
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {shopPrice.price.price_per_base_unit.toFixed(2)} AED/unit
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center">
                                  {shopPrice.inventory.in_stock ? (
                                    <div className="flex items-center text-green-600">
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      <span className="text-sm">In Stock</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-red-600">
                                      <XCircleIcon className="h-4 w-4 mr-1" />
                                      <span className="text-sm">Out of Stock</span>
                                    </div>
                                  )}
                                  {shopPrice.inventory.lead_time_days > 0 && (
                                    <span className="ml-2 text-sm text-gray-500">
                                      {shopPrice.inventory.lead_time_days} days
                                    </span>
                                  )}
                                </div>
                                
                                {includeDelivery && shopPrice.delivery_fee > 0 && (
                                  <span className="text-sm text-gray-500">
                                    +{shopPrice.delivery_fee.toFixed(2)} delivery
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
                      <div className="flex space-x-2">
                        {currentBOM.id && (
                          <button
                            onClick={() => handleAddToBOM(item.variant.id)}
                            disabled={addToBOMMutation.isPending}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            <DocumentPlusIcon className="h-4 w-4 mr-2" />
                            Add to BOM
                          </button>
                        )}
                        <Link
                          to={`/product/${item.variant.product_id}`}
                          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ComparisonTable;