import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Search, Filter, Grid, List, MapPin, ShoppingCart, BarChart3, Plus, Minus, Eye, Star, Package, AlertCircle, Loader2, X } from 'lucide-react';

// Types and interfaces
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
  product?: {
    canonical_name: string;
    base_unit: string;
    category_id: string;
    description?: string;
  };
}

interface Price {
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
  shop?: {
    id: string;
    name: string;
    verified: boolean;
    rating_average: number;
    location_lat: number;
    location_lng: number;
  };
}

interface SearchFilters {
  query: string;
  category: string;
  brand: string[];
  price_min: number | null;
  price_max: number | null;
  location_lat: number | null;
  location_lng: number | null;
  radius: number;
  in_stock: boolean | null;
  sort: string;
}

const UV_SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [localQuery, setLocalQuery] = useState('');

  // Zustand store access with individual selectors
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const userLocation = useAppStore(state => state.user_location);
  const currency = useAppStore(state => state.app_preferences.currency);
  // const language = useAppStore(state => state.app_preferences.language);
  const comparisonProductIds = useAppStore(state => state.active_comparison.product_ids);
  const currentBOM = useAppStore(state => state.current_bom);
  const addToComparison = useAppStore(state => state.add_to_comparison);
  const removeFromComparison = useAppStore(state => state.remove_from_comparison);
  const addBomItem = useAppStore(state => state.add_bom_item);

  // Parse URL parameters into filters
  const filters = useMemo<SearchFilters>(() => {
    const brandParam = searchParams.get('brand');
    return {
      query: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      brand: brandParam ? brandParam.split(',') : [],
      price_min: searchParams.get('price_min') ? Number(searchParams.get('price_min')) : null,
      price_max: searchParams.get('price_max') ? Number(searchParams.get('price_max')) : null,
      location_lat: searchParams.get('location_lat') ? Number(searchParams.get('location_lat')) : userLocation.coordinates?.lat || null,
      location_lng: searchParams.get('location_lng') ? Number(searchParams.get('location_lng')) : userLocation.coordinates?.lng || null,
      radius: Number(searchParams.get('radius') || '10'),
      in_stock: searchParams.get('in_stock') === 'true' ? true : searchParams.get('in_stock') === 'false' ? false : null,
      sort: searchParams.get('sort') || 'relevance',
    };
  }, [searchParams, userLocation.coordinates]);

  // Initialize local query from URL
  useEffect(() => {
    setLocalQuery(filters.query);
  }, [filters.query]);

  // Search products query
  const searchProductsQuery = useQuery({
    queryKey: ['searchProducts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.query) params.append('query', filters.query);
      if (filters.brand.length > 0) params.append('brand', filters.brand.join(','));
      params.append('is_active', 'true');
      params.append('limit', '20');
      params.append('offset', '0');
      
      // Map sort values to API parameters
      if (filters.sort === 'price_asc') {
        params.append('sort_by', 'price');
        params.append('sort_order', 'asc');
      } else if (filters.sort === 'price_desc') {
        params.append('sort_by', 'price');
        params.append('sort_order', 'desc');
      } else {
        params.append('sort_by', 'brand');
        params.append('sort_order', 'asc');
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/product-variants?${params.toString()}`
      );
      
      return response.data;
    },
    enabled: true,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch prices for search results
  const pricesQuery = useQuery({
    queryKey: ['searchPrices', searchProductsQuery.data?.variants],
    queryFn: async () => {
      if (!searchProductsQuery.data?.variants?.length) return { prices: [] };
      
      const variantIds = searchProductsQuery.data.variants.map((v: ProductVariant) => v.id);
      const params = new URLSearchParams();
      
      variantIds.forEach(id => params.append('variant_id', id));
      params.append('verified', 'true');
      params.append('sort_by', 'price');
      params.append('sort_order', 'asc');
      params.append('limit', '100');

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/prices?${params.toString()}`
      );
      
      return response.data;
    },
    enabled: !!searchProductsQuery.data?.variants?.length,
    staleTime: 300000, // 5 minutes for pricing
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Group prices by variant
  const pricesByVariant = useMemo(() => {
    if (!pricesQuery.data?.prices) return {};
    
    return pricesQuery.data.prices.reduce((acc: Record<string, Price[]>, price: Price) => {
      if (!acc[price.variant_id]) {
        acc[price.variant_id] = [];
      }
      acc[price.variant_id].push(price);
      return acc;
    }, {});
  }, [pricesQuery.data?.prices]);

  // Update URL parameters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        newParams.delete(key);
      } else if (Array.isArray(value)) {
        newParams.set(key, value.join(','));
      } else {
        newParams.set(key, String(value));
      }
    });
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle search submission
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ query: localQuery.trim() });
  }, [localQuery, updateFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterKey: keyof SearchFilters, value: any) => {
    updateFilters({ [filterKey]: value });
  }, [updateFilters]);

  // Handle comparison toggle
  const handleComparisonToggle = useCallback((variantId: string) => {
    if (comparisonProductIds.includes(variantId)) {
      removeFromComparison(variantId);
    } else {
      if (comparisonProductIds.length >= 10) {
        alert('Maximum 10 products can be compared at once');
        return;
      }
      addToComparison(variantId);
    }
  }, [comparisonProductIds, addToComparison, removeFromComparison]);

  // Handle add to BOM
  const handleAddToBOM = useCallback(async (variantId: string) => {
    if (!isAuthenticated) {
      alert('Please login to add items to BOM');
      return;
    }

    if (!currentBOM.id) {
      alert('Please create a BOM first');
      return;
    }

    const quantity = selectedQuantities[variantId] || 1;
    
    try {
      await addBomItem({
        variant_id: variantId,
        quantity,
        unit: 'piece', // Default unit
        waste_factor: 0,
        notes: null,
      });
      
      // Reset quantity after adding
      setSelectedQuantities(prev => ({ ...prev, [variantId]: 1 }));
      alert('Item added to BOM successfully');
    } catch (error) {
      console.error('Failed to add item to BOM:', error);
      alert('Failed to add item to BOM');
    }
  }, [isAuthenticated, currentBOM.id, selectedQuantities, addBomItem]);

  // Handle quantity change
  const handleQuantityChange = useCallback((variantId: string, delta: number) => {
    setSelectedQuantities(prev => ({
      ...prev,
      [variantId]: Math.max(1, (prev[variantId] || 1) + delta)
    }));
  }, []);

  // Get best price for variant
  const getBestPrice = useCallback((variantId: string): Price | null => {
    const prices = pricesByVariant[variantId];
    if (!prices || prices.length === 0) return null;
    return prices.reduce((best, current) => 
      current.price_per_base_unit < best.price_per_base_unit ? current : best
    );
  }, [pricesByVariant]);

  // Get shop count for variant
  const getShopCount = useCallback((variantId: string): number => {
    return pricesByVariant[variantId]?.length || 0;
  }, [pricesByVariant]);

  // Check if variant is in stock
  const isInStock = useCallback((variantId: string): boolean => {
    const prices = pricesByVariant[variantId];
    return prices ? prices.some(p => p.shop?.verified) : false;
  }, [pricesByVariant]);

  // Product card component
  const ProductCard: React.FC<{ variant: ProductVariant; isGridView: boolean }> = ({ variant, isGridView }) => {
    const bestPrice = getBestPrice(variant.id);
    const shopCount = getShopCount(variant.id);
    const inStock = isInStock(variant.id);
    const isSelected = comparisonProductIds.includes(variant.id);
    const quantity = selectedQuantities[variant.id] || 1;

    if (!isGridView) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center space-x-6">
            {/* Product Image */}
            <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
              {variant.image_url ? (
                <img 
                  src={variant.image_url} 
                  alt={variant.product?.canonical_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0ibTMgNiAzIDEgMTQgMCAzLTF2MTBsLTMgMUg2bC0zLTFWNloiIGZpbGw9IiNmM2Y0ZjYiLz4KPHBhdGggZD0ibTkgOSAyIDRoMmwyLTQtMy0xLTMgMVoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Package className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    <Link 
                      to={`/product/${variant.product_id}?variant=${variant.id}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {variant.product?.canonical_name || 'Unknown Product'}
                    </Link>
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                    {variant.brand && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {variant.brand}
                      </span>
                    )}
                    {variant.grade && (
                      <span className="text-gray-500">Grade: {variant.grade}</span>
                    )}
                    {variant.size && (
                      <span className="text-gray-500">Size: {variant.size}</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{shopCount} shops</span>
                    </div>
                    
                    <div className={`flex items-center space-x-1 ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-xs font-medium">
                        {inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price and Actions */}
                <div className="flex-shrink-0 text-right ml-6">
                  {bestPrice ? (
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {bestPrice.price.toFixed(2)} {currency}
                      </div>
                      <div className="text-sm text-gray-500">
                        per {variant.product?.base_unit || 'unit'}
                      </div>
                      {bestPrice.shop?.verified && (
                        <div className="flex items-center justify-end mt-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="text-xs text-gray-500 ml-1">Verified</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 mb-3">Price not available</div>
                  )}

                  <div className="flex items-center space-x-2">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-gray-300 rounded">
                      <button
                        onClick={() => handleQuantityChange(variant.id, -1)}
                        className="p-1 hover:bg-gray-100 transition-colors"
                        disabled={quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 py-1 text-sm font-medium min-w-[2rem] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(variant.id, 1)}
                        className="p-1 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <button
                      onClick={() => handleComparisonToggle(variant.id)}
                      className={`p-2 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600'
                      }`}
                      title="Add to comparison"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>

                    {isAuthenticated && currentBOM.id && (
                      <button
                        onClick={() => handleAddToBOM(variant.id)}
                        className="p-2 rounded-lg border border-green-300 text-green-600 hover:bg-green-50 transition-colors"
                        title="Add to BOM"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    )}

                    <Link
                      to={`/product/${variant.product_id}?variant=${variant.id}`}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Grid view
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {variant.image_url ? (
            <img 
              src={variant.image_url} 
              alt={variant.product?.canonical_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0ibTMgNiAzIDEgMTQgMCAzLTF2MTBsLTMgMUg2bC0zLTFWNloiIGZpbGw9IiNmM2Y0ZjYiLz4KPHBhdGggZD0ibTkgOSAyIDRoMmwyLTQtMy0xLTMgMVoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Package className="w-16 h-16" />
            </div>
          )}
          
          {/* Comparison Checkbox */}
          <div className="absolute top-3 left-3">
            <button
              onClick={() => handleComparisonToggle(variant.id)}
              className={`w-6 h-6 rounded border-2 transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 hover:border-blue-500'
              }`}
              title="Add to comparison"
            >
              {isSelected && <span className="block w-full text-center text-xs">✓</span>}
            </button>
          </div>

          {/* Stock Status */}
          <div className="absolute top-3 right-3">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {inStock ? 'In Stock' : 'Out of Stock'}
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]">
            <Link 
              to={`/product/${variant.product_id}?variant=${variant.id}`}
              className="hover:text-blue-600 transition-colors"
            >
              {variant.product?.canonical_name || 'Unknown Product'}
            </Link>
          </h3>

          <div className="flex flex-wrap gap-1 mb-3">
            {variant.brand && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {variant.brand}
              </span>
            )}
            {variant.grade && (
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                {variant.grade}
              </span>
            )}
          </div>

          {/* Price */}
          {bestPrice ? (
            <div className="mb-4">
              <div className="text-xl font-bold text-gray-900">
                {bestPrice.price.toFixed(2)} {currency}
              </div>
              <div className="text-sm text-gray-500">
                per {variant.product?.base_unit || 'unit'}
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span>{shopCount} shops</span>
                </div>
                {bestPrice.shop?.verified && (
                  <div className="flex items-center">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-500 ml-1">Verified</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 mb-4">Price not available</div>
          )}

          {/* Quantity and Actions */}
          <div className="space-y-3">
            {/* Quantity Selector */}
            <div className="flex items-center justify-center">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => handleQuantityChange(variant.id, -1)}
                  className="p-2 hover:bg-gray-100 transition-colors rounded-l-lg"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[3rem] text-center border-x border-gray-300">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(variant.id, 1)}
                  className="p-2 hover:bg-gray-100 transition-colors rounded-r-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {isAuthenticated && currentBOM.id && (
                <button
                  onClick={() => handleAddToBOM(variant.id)}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to BOM</span>
                </button>
              )}
              
              <Link
                to={`/product/${variant.product_id}?variant=${variant.id}`}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Search Header */}
        <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    placeholder="Search construction materials..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  {localQuery && (
                    <button
                      type="button"
                      onClick={() => setLocalQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </form>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-lg border transition-colors ${
                  showFilters
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-blue-500'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Active Filters */}
            {(filters.query || filters.brand.length > 0 || filters.category || filters.price_min || filters.price_max || filters.in_stock !== null) && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm text-gray-600">Filters:</span>
                
                {filters.query && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    Search: "{filters.query}"
                    <button
                      onClick={() => handleFilterChange('query', '')}
                      className="ml-2 hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {filters.brand.map(brand => (
                  <span key={brand} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    Brand: {brand}
                    <button
                      onClick={() => handleFilterChange('brand', filters.brand.filter(b => b !== brand))}
                      className="ml-2 hover:text-green-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                
                {filters.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                    Category: {filters.category}
                    <button
                      onClick={() => handleFilterChange('category', '')}
                      className="ml-2 hover:text-purple-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {(filters.price_min || filters.price_max) && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                    Price: {filters.price_min || 0} - {filters.price_max || '∞'} {currency}
                    <button
                      onClick={() => {
                        handleFilterChange('price_min', null);
                        handleFilterChange('price_max', null);
                      }}
                      className="ml-2 hover:text-yellow-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                
                {filters.in_stock !== null && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                    {filters.in_stock ? 'In Stock Only' : 'Include Out of Stock'}
                    <button
                      onClick={() => handleFilterChange('in_stock', null)}
                      className="ml-2 hover:text-red-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <button
                  onClick={() => {
                    setSearchParams({});
                    setLocalQuery('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-6">
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="w-80 flex-shrink-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-32">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
                  
                  {/* Category Filter */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Categories</option>
                      <option value="cement">Cement</option>
                      <option value="steel">Steel</option>
                      <option value="concrete">Concrete</option>
                      <option value="bricks">Bricks</option>
                      <option value="paint">Paint</option>
                      <option value="tiles">Tiles</option>
                    </select>
                  </div>

                  {/* Price Range */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price Range ({currency})
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.price_min || ''}
                        onChange={(e) => handleFilterChange('price_min', e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.price_max || ''}
                        onChange={(e) => handleFilterChange('price_max', e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Stock Status */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Availability
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="stock"
                          checked={filters.in_stock === null}
                          onChange={() => handleFilterChange('in_stock', null)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">All products</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="stock"
                          checked={filters.in_stock === true}
                          onChange={() => handleFilterChange('in_stock', true)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">In stock only</span>
                      </label>
                    </div>
                  </div>

                  {/* Sort Options */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort by
                    </label>
                    <select
                      value={filters.sort}
                      onChange={(e) => handleFilterChange('sort', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Customer Rating</option>
                      <option value="distance">Distance</option>
                    </select>
                  </div>

                  {/* Location Radius */}
                  {userLocation.coordinates && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Radius (km)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={filters.radius}
                        onChange={(e) => handleFilterChange('radius', Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1 km</span>
                        <span>{filters.radius} km</span>
                        <span>50 km</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1">
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {filters.query ? `Search Results for "${filters.query}"` : 'All Products'}
                  </h2>
                  {searchProductsQuery.data && (
                    <span className="text-gray-500">
                      ({searchProductsQuery.data.total || 0} products)
                    </span>
                  )}
                </div>

                {/* Comparison Counter */}
                {comparisonProductIds.length > 0 && (
                  <Link
                    to="/compare"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Compare ({comparisonProductIds.length})</span>
                  </Link>
                )}
              </div>

              {/* Loading State */}
              {searchProductsQuery.isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center space-x-3 text-gray-600">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Searching products...</span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {searchProductsQuery.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Search Failed</h3>
                  <p className="text-red-700 mb-4">
                    We couldn't load the search results. Please try again.
                  </p>
                  <button
                    onClick={() => searchProductsQuery.refetch()}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* No Results */}
              {searchProductsQuery.data && (!searchProductsQuery.data.variants || searchProductsQuery.data.variants.length === 0) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-600 mb-6">
                    {filters.query 
                      ? `No products match your search for "${filters.query}"`
                      : 'No products match your current filters'
                    }
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Try:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Checking your spelling</li>
                      <li>• Using fewer or different keywords</li>
                      <li>• Removing some filters</li>
                      <li>• Browsing categories instead</li>
                    </ul>
                  </div>
                  <Link
                    to="/categories"
                    className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Browse Categories
                  </Link>
                </div>
              )}

              {/* Products Grid/List */}
              {searchProductsQuery.data?.variants && searchProductsQuery.data.variants.length > 0 && (
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                    : 'space-y-4'
                }>
                  {searchProductsQuery.data.variants.map((variant: ProductVariant) => (
                    <ProductCard
                      key={variant.id}
                      variant={variant}
                      isGridView={viewMode === 'grid'}
                    />
                  ))}
                </div>
              )}

              {/* Load More Button */}
              {searchProductsQuery.data?.variants && searchProductsQuery.data.variants.length > 0 && (
                <div className="mt-12 text-center">
                  <button className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-200 transition-colors">
                    Load More Products
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SearchResults;