import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { MapPin, Search, Filter, Route, Navigation, Plus, Minus, Target } from 'lucide-react';

// Types
interface Shop {
  id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  shop_type: string | null;
  rating_average: number;
  verified: boolean;
  distance_km?: number;
  phones?: string[];
  address?: string;
  hours?: Record<string, string> | null;
  product_count?: number;
}

interface ShopCluster {
  lat: number;
  lng: number;
  count: number;
  radius: number;
}

interface MapFilters {
  shop_type: string | null;
  product_search: string | null;
  radius_km: number;
  verified_only: boolean;
}

interface RoutePlanningMode {
  active: boolean;
  selected_shops: string[];
  optimized_route: any | null;
}

// API Functions
const fetchMapShops = async (params: {
  lat: number;
  lng: number;
  zoom: number;
  shop_type?: string | null;
  product_search?: string | null;
  bounds?: string;
}): Promise<{ shops: Shop[]; clusters: ShopCluster[] }> => {
  const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/map/shops`, {
    params: {
      lat: params.lat,
      lng: params.lng,
      zoom: params.zoom,
      shop_type: params.shop_type || undefined,
      product_search: params.product_search || undefined,
      bounds: params.bounds || undefined,
    },
  });
  return response.data;
};

const fetchNearbyShops = async (params: {
  lat: number;
  lng: number;
  radius: number;
  shop_type?: string | null;
  product_search?: string | null;
  limit?: number;
}): Promise<{ shops: Shop[] }> => {
  const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/near-me`, {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius: params.radius,
      shop_type: params.shop_type || undefined,
      product_search: params.product_search || undefined,
      limit: params.limit || 20,
    },
  });
  return response.data;
};

const fetchShopDetails = async (shopId: string): Promise<Shop> => {
  const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/${shopId}`);
  return response.data;
};

const planOptimalRoute = async (params: {
  shop_ids: string[];
  start_location: { lat: number; lng: number };
  return_to_start: boolean;
}, authToken: string) => {
  const response = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/trip-planner`,
    params,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

// Utility functions
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

const UV_MapView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state - individual selectors to avoid infinite loops
  const userLocation = useAppStore(state => state.user_location);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateUserLocation = useAppStore(state => state.update_user_location);

  // Local state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: parseFloat(searchParams.get('lat') || '25.2048'),
    lng: parseFloat(searchParams.get('lng') || '55.2708'),
  });
  
  const [mapZoomLevel, setMapZoomLevel] = useState<number>(
    parseInt(searchParams.get('zoom') || '12')
  );
  
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    shop_type: searchParams.get('shop_type'),
    product_search: searchParams.get('product_search'),
    radius_km: 10,
    verified_only: false,
  });
  
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [routePlanningMode, setRoutePlanningMode] = useState<RoutePlanningMode>({
    active: false,
    selected_shops: [],
    optimized_route: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // Calculate map bounds for API call
  const mapBounds = useMemo(() => {
    const latOffset = 0.05 * Math.pow(2, 12 - mapZoomLevel);
    const lngOffset = 0.05 * Math.pow(2, 12 - mapZoomLevel);
    return `${mapCenter.lat + latOffset},${mapCenter.lat - latOffset},${mapCenter.lng + lngOffset},${mapCenter.lng - lngOffset}`;
  }, [mapCenter, mapZoomLevel]);

  // Load shops visible on map
  const { data: mapData, isLoading: isLoadingShops, error: shopsError } = useQuery({
    queryKey: ['mapShops', mapCenter.lat, mapCenter.lng, mapZoomLevel, mapFilters.shop_type, mapFilters.product_search, mapBounds],
    queryFn: () => fetchMapShops({
      lat: mapCenter.lat,
      lng: mapCenter.lng,
      zoom: mapZoomLevel,
      shop_type: mapFilters.shop_type,
      product_search: mapFilters.product_search,
      bounds: mapBounds,
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Search nearby shops mutation
  const nearbyShopsMutation = useMutation({
    mutationFn: fetchNearbyShops,
  });

  // Shop details query
  const { data: shopDetails, isLoading: isLoadingShopDetails } = useQuery({
    queryKey: ['shopDetails', selectedShop?.id],
    queryFn: () => fetchShopDetails(selectedShop!.id),
    enabled: !!selectedShop?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Route planning mutation
  const routePlanningMutation = useMutation({
    mutationFn: ({ shop_ids, start_location, return_to_start }: any) => 
      planOptimalRoute({ shop_ids, start_location, return_to_start }, authToken!),
  });

  // Update URL parameters when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set('lat', mapCenter.lat.toString());
    newParams.set('lng', mapCenter.lng.toString());
    newParams.set('zoom', mapZoomLevel.toString());
    
    if (mapFilters.shop_type) newParams.set('shop_type', mapFilters.shop_type);
    if (mapFilters.product_search) newParams.set('product_search', mapFilters.product_search);
    
    setSearchParams(newParams, { replace: true });
  }, [mapCenter, mapZoomLevel, mapFilters, setSearchParams]);

  // Initialize map center from user location if available
  useEffect(() => {
    if (userLocation.coordinates && !searchParams.get('lat') && !searchParams.get('lng')) {
      setMapCenter({
        lat: userLocation.coordinates.lat,
        lng: userLocation.coordinates.lng,
      });
    }
  }, [userLocation.coordinates, searchParams]);

  // Get user location
  const handleGetUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            coordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
          };
          updateUserLocation(newLocation);
          setMapCenter(newLocation.coordinates);
          setLocationPermission('granted');
          
          // Search for nearby shops
          nearbyShopsMutation.mutate({
            lat: newLocation.coordinates.lat,
            lng: newLocation.coordinates.lng,
            radius: mapFilters.radius_km,
            shop_type: mapFilters.shop_type,
            product_search: mapFilters.product_search,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationPermission('denied');
        }
      );
    }
  }, [updateUserLocation, mapFilters, nearbyShopsMutation]);

  // Handle shop marker click
  const handleShopClick = useCallback((shop: Shop) => {
    if (routePlanningMode.active) {
      setRoutePlanningMode(prev => ({
        ...prev,
        selected_shops: prev.selected_shops.includes(shop.id)
          ? prev.selected_shops.filter(id => id !== shop.id)
          : [...prev.selected_shops, shop.id],
      }));
    } else {
      setSelectedShop(shop);
    }
  }, [routePlanningMode.active]);

  // Handle map controls
  const handleZoomIn = useCallback(() => {
    setMapZoomLevel(prev => Math.min(18, prev + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setMapZoomLevel(prev => Math.max(1, prev - 1));
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!routePlanningMode.active) {
      setMapCenter({ lat, lng });
    }
  }, [routePlanningMode.active]);

  // Handle route planning
  const handlePlanRoute = useCallback(() => {
    if (routePlanningMode.selected_shops.length > 1 && userLocation.coordinates && authToken) {
      routePlanningMutation.mutate({
        shop_ids: routePlanningMode.selected_shops,
        start_location: userLocation.coordinates,
        return_to_start: true,
      }, {
        onSuccess: (data) => {
          setRoutePlanningMode(prev => ({
            ...prev,
            optimized_route: data.route,
          }));
        },
      });
    }
  }, [routePlanningMode.selected_shops, userLocation.coordinates, authToken, routePlanningMutation]);

  // Filter shops based on current filters
  const filteredShops = useMemo(() => {
    if (!mapData?.shops) return [];
    
    return mapData.shops.filter(shop => {
      if (mapFilters.verified_only && !shop.verified) return false;
      return true;
    });
  }, [mapData?.shops, mapFilters.verified_only]);

  // Render shop marker
  const renderShopMarker = (shop: Shop, index: number) => {
    const isSelected = selectedShop?.id === shop.id;
    const isInRoute = routePlanningMode.selected_shops.includes(shop.id);
    
    return (
      <div
        key={shop.id}
        className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 ${
          isSelected ? 'z-30' : isInRoute ? 'z-20' : 'z-10'
        }`}
        style={{
          left: `${((shop.location_lng - (mapCenter.lng - 0.05)) / 0.1) * 100}%`,
          top: `${((mapCenter.lat + 0.05 - shop.location_lat) / 0.1) * 100}%`,
        }}
        onClick={() => handleShopClick(shop)}
      >
        <div className={`relative ${isSelected ? 'animate-pulse' : ''}`}>
          <MapPin 
            className={`w-6 h-6 ${
              isInRoute 
                ? 'text-purple-600' 
                : shop.verified 
                ? 'text-blue-600' 
                : 'text-gray-600'
            }`}
            fill="currentColor"
          />
          {shop.verified && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
          {isInRoute && (
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {routePlanningMode.selected_shops.indexOf(shop.id) + 1}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render cluster marker
  const renderClusterMarker = (cluster: ShopCluster, index: number) => {
    return (
      <div
        key={`cluster-${index}`}
        className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{
          left: `${((cluster.lng - (mapCenter.lng - 0.05)) / 0.1) * 100}%`,
          top: `${((mapCenter.lat + 0.05 - cluster.lat) / 0.1) * 100}%`,
        }}
        onClick={() => {
          setMapCenter({ lat: cluster.lat, lng: cluster.lng });
          setMapZoomLevel(prev => Math.min(18, prev + 2));
        }}
      >
        <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-2 border-white shadow-lg hover:bg-blue-700 transition-colors">
          {cluster.count}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Shop Map</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Zoom: {mapZoomLevel}</span>
              <span className="text-sm text-gray-500">
                Shops: {filteredShops.length}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleGetUserLocation}
              disabled={locationPermission === 'denied'}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Target className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setRoutePlanningMode(prev => ({ 
                ...prev, 
                active: !prev.active,
                selected_shops: prev.active ? [] : prev.selected_shops,
                optimized_route: prev.active ? null : prev.optimized_route,
              }))}
              className={`p-2 rounded-lg transition-colors ${
                routePlanningMode.active 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Route className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Filters Panel */}
          {showFilters && (
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Map Filters</h2>
                
                {/* Product Search */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={mapFilters.product_search || ''}
                      onChange={(e) => setMapFilters(prev => ({ ...prev, product_search: e.target.value || null }))}
                      placeholder="Search for products..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Shop Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Type
                  </label>
                  <select
                    value={mapFilters.shop_type || ''}
                    onChange={(e) => setMapFilters(prev => ({ ...prev, shop_type: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="hardware_store">Hardware Store</option>
                    <option value="building_materials">Building Materials</option>
                    <option value="electrical_supplies">Electrical Supplies</option>
                    <option value="plumbing_supplies">Plumbing Supplies</option>
                    <option value="paint_supplies">Paint Supplies</option>
                  </select>
                </div>

                {/* Search Radius */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Radius: {mapFilters.radius_km} km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={mapFilters.radius_km}
                    onChange={(e) => setMapFilters(prev => ({ ...prev, radius_km: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1km</span>
                    <span>50km</span>
                  </div>
                </div>

                {/* Verified Only */}
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={mapFilters.verified_only}
                      onChange={(e) => setMapFilters(prev => ({ ...prev, verified_only: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Verified shops only</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Map Container */}
          <div className="flex-1 relative bg-gray-200">
            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-30 flex flex-col space-y-2">
              <button
                onClick={handleZoomIn}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Minus className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Route Planning Controls */}
            {routePlanningMode.active && (
              <div className="absolute top-4 left-4 z-30 bg-white rounded-lg shadow-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Route Planning Mode</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Selected shops: {routePlanningMode.selected_shops.length}
                </p>
                {routePlanningMode.selected_shops.length > 1 && (
                  <button
                    onClick={handlePlanRoute}
                    disabled={routePlanningMutation.isPending || !authToken}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {routePlanningMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        <span>Plan Route</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Loading overlay */}
            {isLoadingShops && (
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20">
                <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-900">Loading shops...</span>
                </div>
              </div>
            )}

            {/* Mock Map Display */}
            <div 
              className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 relative overflow-hidden cursor-crosshair"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                const lat = mapCenter.lat + 0.05 - (y * 0.1);
                const lng = mapCenter.lng - 0.05 + (x * 0.1);
                handleMapClick(lat, lng);
              }}
            >
              {/* Grid lines for visual reference */}
              <div className="absolute inset-0">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full h-px bg-white bg-opacity-30" style={{ top: `${i * 10}%` }} />
                ))}
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={`v-${i}`} className="absolute h-full w-px bg-white bg-opacity-30" style={{ left: `${i * 10}%` }} />
                ))}
              </div>

              {/* Center coordinates display */}
              <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg px-3 py-2 text-sm text-gray-700">
                {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
              </div>

              {/* User location marker */}
              {userLocation.coordinates && (
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                  style={{
                    left: `${((userLocation.coordinates.lng - (mapCenter.lng - 0.05)) / 0.1) * 100}%`,
                    top: `${((mapCenter.lat + 0.05 - userLocation.coordinates.lat) / 0.1) * 100}%`,
                  }}
                >
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                </div>
              )}

              {/* Shop markers */}
              {mapZoomLevel >= 13 
                ? filteredShops.map((shop) => renderShopMarker(shop, index))
                : mapData?.clusters?.map((cluster) => renderClusterMarker(cluster, index))
              }
            </div>
          </div>

          {/* Shop Details Panel */}
          {selectedShop && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedShop.name}</h3>
                  <button
                    onClick={() => setSelectedShop(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
                
                {selectedShop.verified && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                    ✓ Verified
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <span className="font-medium">{selectedShop.rating_average.toFixed(1)}</span>
                    <span className="ml-1">★</span>
                  </div>
                  {selectedShop.distance_km && (
                    <span>{selectedShop.distance_km.toFixed(1)} km away</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingShopDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : shopDetails ? (
                  <div className="space-y-4">
                    {shopDetails.address && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Address</h4>
                        <p className="text-sm text-gray-600">{shopDetails.address}</p>
                      </div>
                    )}
                    
                    {shopDetails.phones && shopDetails.phones.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Phone</h4>
                        {shopDetails.phones.map((phone) => (
                          <p key={index} className="text-sm text-gray-600">{phone}</p>
                        ))}
                      </div>
                    )}
                    
                    {shopDetails.hours && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Hours</h4>
                        <div className="text-sm text-gray-600">
                          {Object.entries(shopDetails.hours).map(([day, hours]) => (
                            <div key={day} className="flex justify-between">
                              <span className="capitalize">{day}</span>
                              <span>{hours}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {shopDetails.shop_type && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Type</h4>
                        <p className="text-sm text-gray-600 capitalize">{shopDetails.shop_type.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="p-4 border-t border-gray-200 space-y-2">
                <Link
                  to={`/shop/${selectedShop.id}`}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center block"
                >
                  View Shop Details
                </Link>
                
                {routePlanningMode.active && (
                  <button
                    onClick={() => handleShopClick(selectedShop)}
                    className={`w-full px-4 py-2 rounded-lg transition-colors ${
                      routePlanningMode.selected_shops.includes(selectedShop.id)
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {routePlanningMode.selected_shops.includes(selectedShop.id)
                      ? 'Remove from Route'
                      : 'Add to Route'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {shopsError && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
            <p className="text-sm">Failed to load shops. Please try again.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_MapView;