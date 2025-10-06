import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  MapIcon, 
  ClockIcon, 
  CurrencyDollarIcon, 
  ShoppingCartIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ShareIcon,
  Bars3Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Interfaces for API responses
interface Shop {
  id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  address: string;
  verified: boolean;
  rating_average: number;
  distance_km?: number;
  estimated_cash_needed?: number;
  estimated_time_minutes?: number;
  items_to_buy?: Array<{
    variant_id: string;
    product_name: string;
    quantity: number;
    estimated_cost: number;
  }>;
}

interface RouteOptimization {
  route: {
    total_distance_km: number;
    estimated_duration_minutes: number;
    stops: Array<{
      shop: Shop;
      order: number;
      items_to_buy: Array<{
        variant_id: string;
        product_name: string;
        quantity: number;
        estimated_cost: number;
      }>;
      estimated_cash_needed: number;
      estimated_time_minutes: number;
    }>;
  };
  summary: {
    total_estimated_cost: number;
    total_cash_needed: number;
    total_items: number;
    potential_savings: number;
  };
}

const UV_TripPlanner: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Global state access with individual selectors
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const currentBOM = useAppStore(state => state.current_bom);
  const userLocation = useAppStore(state => state.user_location);
  const currency = useAppStore(state => state.app_preferences.currency);
  
  // Local state
  const [selectedShops, setSelectedShops] = useState<Shop[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [cashDistribution, setCashDistribution] = useState<{[key: string]: { cash: number; credit: number }}>({});
  const [contingencyPercentage, setContingencyPercentage] = useState(10);
  
  // URL parameters
  const bomIdParam = searchParams.get('bom_id');
  const shopIdsParam = searchParams.get('shop_ids');
  
  // API calls
  const { data: nearbyShops, isLoading: shopsLoading } = useQuery({
    queryKey: ['nearby-shops', userLocation?.coordinates],
    queryFn: async () => {
      if (!userLocation?.coordinates) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/near-me`,
        {
          params: {
            lat: userLocation.coordinates.lat,
            lng: userLocation.coordinates.lng,
            radius: 20,
            limit: 50
          }
        }
      );
      return response.data.shops || [];
    },
    enabled: !!userLocation?.coordinates,
    staleTime: 5 * 60 * 1000
  });

  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom-details', bomIdParam],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${bomIdParam}`,
        {
          headers: {
            Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}`
          }
        }
      );
      return response.data;
    },
    enabled: !!bomIdParam,
    staleTime: 5 * 60 * 1000
  });

  const routeOptimizationMutation = useMutation({
    mutationFn: async (data: {
      bom_id?: string;
      shop_ids: string[];
      start_location?: { lat: number; lng: number };
      return_to_start: boolean;
    }) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/trip-planner`,
        data,
        {
          headers: {
            Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}`
          }
        }
      );
      return response.data as RouteOptimization;
    }
  });

  // Initialize from URL parameters
  useEffect(() => {
    if (shopIdsParam && nearbyShops) {
      const shopIds = shopIdsParam.split(',');
      const preSelectedShops = nearbyShops.filter(shop => shopIds.includes(shop.id));
      setSelectedShops(preSelectedShops);
    }
  }, [shopIdsParam, nearbyShops]);

  // Handle shop selection
  const addShop = (shop: Shop) => {
    if (!selectedShops.find(s => s.id === shop.id)) {
      setSelectedShops(prev => [...prev, shop]);
      setCashDistribution(prev => ({
        ...prev,
        [shop.id]: { cash: 0, credit: 0 }
      }));
    }
    setShowShopSelector(false);
  };

  const removeShop = (shopId: string) => {
    setSelectedShops(prev => prev.filter(s => s.id !== shopId));
    setCashDistribution(prev => {
      const newDist = { ...prev };
      delete newDist[shopId];
      return newDist;
    });
  };

  // Handle route optimization
  const optimizeRoute = () => {
    if (selectedShops.length < 2) return;
    
    routeOptimizationMutation.mutate({
      bom_id: bomIdParam || currentBOM.id || undefined,
      shop_ids: selectedShops.map(s => s.id),
      start_location: userLocation?.coordinates || undefined,
      return_to_start: true
    });
  };

  // Handle drag and drop reordering
  const moveShop = (fromIndex: number, toIndex: number) => {
    const newShops = [...selectedShops];
    const [moved] = newShops.splice(fromIndex, 1);
    newShops.splice(toIndex, 0, moved);
    setSelectedShops(newShops);
  };

  // Calculate cash requirements
  const calculateCashNeeds = () => {
    const routeData = routeOptimizationMutation.data;
    if (!routeData) return { total: 0, contingency: 0 };
    
    const total = routeData.summary.total_cash_needed;
    const contingency = total * (contingencyPercentage / 100);
    
    return { total, contingency };
  };

  const cashNeeds = calculateCashNeeds();
  const filteredShops = nearbyShops?.filter(shop => 
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.address.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Trip Planner</h1>
                <p className="text-lg text-gray-600">
                  Plan your optimal route for material procurement
                </p>
                {bomData && (
                  <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <ShoppingCartIcon className="w-4 h-4 mr-1" />
                    {bomData.title} ({bomData.item_count} items)
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <Link
                  to="/map"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <MapIcon className="w-4 h-4 mr-2" />
                  Map View
                </Link>
                
                <button
                  onClick={() => setShowShopSelector(true)}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Shops
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shop Selection & Route */}
            <div className="lg:col-span-2 space-y-6">
              {/* Selected Shops */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Selected Shops</h2>
                    <span className="text-sm text-gray-500">
                      {selectedShops.length} shop{selectedShops.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  {selectedShops.length === 0 ? (
                    <div className="text-center py-8">
                      <MapIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No shops selected yet</p>
                      <button
                        onClick={() => setShowShopSelector(true)}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add Your First Shop
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedShops.map((shop) => (
                        <div
                          key={shop.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                            moveShop(fromIndex, index);
                          }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium text-gray-900">{shop.name}</h3>
                                {shop.verified && (
                                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{shop.address}</p>
                              {shop.distance_km && (
                                <p className="text-xs text-gray-400">
                                  {shop.distance_km.toFixed(1)}km away
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Bars3Icon className="w-5 h-5 text-gray-400 cursor-grab" />
                            <button
                              onClick={() => removeShop(shop.id)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {selectedShops.length >= 2 && (
                        <div className="pt-4">
                          <button
                            onClick={optimizeRoute}
                            disabled={routeOptimizationMutation.isPending}
                            className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {routeOptimizationMutation.isPending ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                                Optimizing Route...
                              </>
                            ) : (
                              <>
                                <ArrowPathIcon className="w-4 h-4 mr-2" />
                                Optimize Route
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Route Optimization Results */}
              {routeOptimizationMutation.data && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Optimized Route</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <ClockIcon className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Total Time</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {Math.round(routeOptimizationMutation.data.route.estimated_duration_minutes)} min
                        </p>
                      </div>
                      
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <MapIcon className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Total Distance</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {routeOptimizationMutation.data.route.total_distance_km.toFixed(1)} km
                        </p>
                      </div>
                      
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <ShoppingCartIcon className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {routeOptimizationMutation.data.summary.total_items}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {routeOptimizationMutation.data.route.stops.map((stop) => (
                        <div key={stop.shop.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-semibold">
                                {stop.order}
                              </div>
                              <h3 className="font-medium text-gray-900">{stop.shop.name}</h3>
                            </div>
                            <div className="text-sm text-gray-500">
                              {stop.estimated_time_minutes} min
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2">
                            Items: {stop.items_to_buy.length} • 
                            Cash needed: {currency} {stop.estimated_cash_needed.toFixed(2)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            {stop.items_to_buy.slice(0, 4).map((item, idx) => (
                              <div key={idx}>
                                {item.product_name} ({item.quantity})
                              </div>
                            ))}
                            {stop.items_to_buy.length > 4 && (
                              <div className="text-blue-600">
                                +{stop.items_to_buy.length - 4} more items
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cash Planning & Actions */}
            <div className="space-y-6">
              {/* Cash Planning */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Cash Planning</h2>
                </div>
                
                <div className="p-6">
                  {routeOptimizationMutation.data ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Estimated Total</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {currency} {routeOptimizationMutation.data.summary.total_estimated_cost.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-700">Cash Needed</span>
                        <span className="text-lg font-semibold text-blue-900">
                          {currency} {cashNeeds.total.toFixed(2)}
                        </span>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contingency Buffer ({contingencyPercentage}%)
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="25"
                          value={contingencyPercentage}
                          onChange={(e) => setContingencyPercentage(Number(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg mt-2">
                          <span className="text-sm font-medium text-yellow-700">
                            + Contingency
                          </span>
                          <span className="text-lg font-semibold text-yellow-900">
                            {currency} {cashNeeds.contingency.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-700">
                            Total Cash Required
                          </span>
                          <span className="text-xl font-bold text-green-900">
                            {currency} {(cashNeeds.total + cashNeeds.contingency).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {routeOptimizationMutation.data.summary.potential_savings > 0 && (
                        <div className="flex items-center p-3 bg-green-100 rounded-lg">
                          <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                          <span className="text-sm text-green-700">
                            Potential savings: {currency} {routeOptimizationMutation.data.summary.potential_savings.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CurrencyDollarIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        Select shops and optimize route to see cash requirements
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Actions</h2>
                </div>
                
                <div className="p-6 space-y-3">
                  <button
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    disabled={!routeOptimizationMutation.data}
                  >
                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                    Generate Shopping Lists
                  </button>
                  
                  <button
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    disabled={!routeOptimizationMutation.data}
                  >
                    <ShareIcon className="w-4 h-4 mr-2" />
                    Share Trip Plan
                  </button>
                  
                  <button
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    disabled={!routeOptimizationMutation.data}
                  >
                    <MapIcon className="w-4 h-4 mr-2" />
                    Start Navigation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Selector Modal */}
        {showShopSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Add Shops to Route</h2>
                  <button
                    onClick={() => setShowShopSelector(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search shops by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-96">
                {shopsLoading ? (
                  <div className="text-center py-8">
                    <ArrowPathIcon className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-500">Loading nearby shops...</p>
                  </div>
                ) : filteredShops.length === 0 ? (
                  <div className="text-center py-8">
                    <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No shops found matching your criteria</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredShops.map((shop) => (
                      <div
                        key={shop.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{shop.name}</h3>
                            {shop.verified && (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{shop.address}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            {shop.distance_km && (
                              <span className="text-xs text-gray-400">
                                {shop.distance_km.toFixed(1)}km away
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              ⭐ {shop.rating_average.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => addShop(shop)}
                          disabled={selectedShops.some(s => s.id === shop.id)}
                          className="ml-4 px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                          {selectedShops.some(s => s.id === shop.id) ? 'Added' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_TripPlanner;