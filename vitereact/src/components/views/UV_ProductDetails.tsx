import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { ArrowUpDown, Star, MapPin, Phone, MessageCircle, Plus, ShoppingCart, Heart, ChevronLeft, ChevronRight, ExternalLink, AlertCircle, CheckCircle, Zap } from 'lucide-react';

// Interfaces

interface ProductVariant {
  id: string;
  product_id: string;
  brand?: string;
  grade?: string;
  size?: string;
  pack_quantity?: number;
  pack_unit?: string;
  unit_to_base_factor: number;
  sku?: string;
  barcode?: string;
  image_url?: string;
  specifications?: Record<string, any>;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  prices?: PriceWithShop[];
}

interface PriceWithShop {
  id: string;
  price: number;
  currency: string;
  price_per_base_unit: number;
  bulk_pricing_tiers?: any[];
  promotional_price?: number;
  promotion_start_date?: number;
  promotion_end_date?: number;
  verified: boolean;
  verifications_count: number;
  shop: Shop;
  inventory?: InventoryItem;
  distance_km?: number;
}

interface Shop {
  id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  verified: boolean;
  rating_average: number;
  delivery_available: boolean;
  delivery_fee_base?: number;
  delivery_fee_per_km?: number;
  phones: string[];
  hours?: Record<string, string>;
  address: string;
}

interface InventoryItem {
  shop_id: string;
  variant_id: string;
  in_stock: boolean;
  stock_quantity?: number;
  lead_time_days: number;
  minimum_order_quantity: number;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  review_text?: string;
  verified_purchase: boolean;
  helpful_votes: number;
  total_votes: number;
  created_at: number;
  user?: {
    name: string;
    user_type: string;
  };
}

interface ProductDetailsResponse {
  id: string;
  canonical_name: string;
  category_id: string;
  subcategory?: string;
  base_unit: string;
  description?: string;
  specifications?: Record<string, any>;
  image_url?: string;
  waste_factor_percentage: number;
  variants: ProductVariant[];
}

const UV_ProductDetails: React.FC = () => {
  // URL Parameters
  const { product_id } = useParams<{ product_id: string }>();
  const [searchParams] = useSearchParams();
  const quantityParam = searchParams.get('quantity');
  const shopIdParam = searchParams.get('shop_id');
  // const compareParam = searchParams.get('compare');

  // Local State
  const [selectedQuantity, setSelectedQuantity] = useState<number>(
    quantityParam ? parseInt(quantityParam) : 1
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  // const [showAllSpecs, setShowAllSpecs] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'specifications'>('overview');

  // Global State Access (Individual selectors to avoid infinite loops)
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentBom = useAppStore(state => state.current_bom);
  const activeComparison = useAppStore(state => state.active_comparison);
  const userLocation = useAppStore(state => state.user_location);
  // const language = useAppStore(state => state.app_preferences.language);
  const currency = useAppStore(state => state.app_preferences.currency);

  // Store Actions
  const addBomItem = useAppStore(state => state.add_bom_item);
  const createBom = useAppStore(state => state.create_bom);
  const addToComparison = useAppStore(state => state.add_to_comparison);

  // API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Data Fetching with React Query
  const {
    data: productData,
    isLoading: isProductLoading,
    error: productError,
  } = useQuery({
    queryKey: ['product', product_id, selectedQuantity, userLocation?.coordinates],
    queryFn: async () => {
      if (!product_id) throw new Error('Product ID is required');

      const params = new URLSearchParams({
        quantity: selectedQuantity.toString(),
        radius: '10',
      });

      if (userLocation?.coordinates) {
        params.append('location_lat', userLocation.coordinates.lat.toString());
        params.append('location_lng', userLocation.coordinates.lng.toString());
      }

      if (shopIdParam) {
        params.append('shop_id', shopIdParam);
      }

      const response = await axios.get<ProductDetailsResponse>(
        `${API_BASE_URL}/api/products/${product_id}?${params.toString()}`
      );

      return response.data;
    },
    enabled: !!product_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      ...data,
      variants: data.variants.map(variant => ({
        ...variant,
        prices: variant.prices?.map(price => ({
          ...price,
          price: Number(price.price || 0),
          price_per_base_unit: Number(price.price_per_base_unit || 0),
        })) || [],
      })),
    }),
  });

  const {
    data: reviewsData,
    isLoading: isReviewsLoading,
  } = useQuery({
    queryKey: ['reviews', selectedVariantId],
    queryFn: async () => {
      if (!selectedVariantId) return { reviews: [], rating_summary: {} };

      const response = await axios.get(
        `${API_BASE_URL}/api/reviews?variant_id=${selectedVariantId}&limit=20&sort_by=created_at&sort_order=desc`
      );

      return response.data;
    },
    enabled: !!selectedVariantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Set selected variant when product data loads
  useEffect(() => {
    if (productData?.variants?.length && !selectedVariantId) {
      setSelectedVariantId(productData.variants[0].id);
    }
  }, [productData?.variants, selectedVariantId]);

  // Handle adding to BOM
  const handleAddToBOM = async () => {
    if (!selectedVariantId || !isAuthenticated) return;

    try {
      if (!currentBom.id) {
        // Create new BOM first
        await createBom({
          title: `Project with ${productData?.canonical_name}`,
          description: 'Auto-created from product details',
        });
      }

      await addBomItem({
        variant_id: selectedVariantId,
        quantity: selectedQuantity,
        unit: productData?.base_unit || 'piece',
        waste_factor: productData?.waste_factor_percentage || 0,
      });
    } catch (error) {
      console.error('Failed to add to BOM:', error);
    }
  };

  // Handle adding to comparison
  const handleAddToComparison = () => {
    if (selectedVariantId) {
      addToComparison(selectedVariantId);
    }
  };

  // Get current variant data
  const currentVariant = productData?.variants?.find(v => v.id === selectedVariantId);
  const currentPrices = currentVariant?.prices || [];

  // Sort prices by best value
  const sortedPrices = [...currentPrices]
    .filter(price => price.shop)
    .sort((a, b) => {
      // Prioritize in-stock items
      if (a.inventory?.in_stock && !b.inventory?.in_stock) return -1;
      if (!a.inventory?.in_stock && b.inventory?.in_stock) return 1;
      
      // Then sort by price
      return a.price_per_base_unit - b.price_per_base_unit;
    });

  const bestPrice = sortedPrices[0];
  const totalPrice = bestPrice ? bestPrice.price_per_base_unit * selectedQuantity : 0;

  // Calculate savings compared to highest price
  const highestPrice = Math.max(...sortedPrices.map(p => p.price_per_base_unit));
  const savings = bestPrice && highestPrice > bestPrice.price_per_base_unit 
    ? (highestPrice - bestPrice.price_per_base_unit) * selectedQuantity 
    : 0;

  // Image gallery handling
  const allImages = [
    "" ?? "",
    "" ?? "",
    ...(sortedPrices.slice(0, 3).map(p => "" ?? "").filter(Boolean) || [])
  ].filter(Boolean) as string[];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  if (isProductLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="aspect-square bg-gray-300 rounded-lg"></div>
                <div className="space-y-4">
                  <div className="h-8 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-300 rounded w-1/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (productError || !productData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
              <p className="text-gray-600 mb-6">
                The product you're looking for doesn't exist or has been removed.
              </p>
              <Link
                to="/search"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Back to Search
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
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <Link to="/" className="hover:text-gray-700">Home</Link>
              <span>/</span>
              <Link to="/categories" className="hover:text-gray-700">Categories</Link>
              <span>/</span>
              <Link to={`/categories/${productData.category_id}`} className="hover:text-gray-700">
                {productData.subcategory || 'Products'}
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{productData.canonical_name}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Main Product Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-square bg-white rounded-xl shadow-lg overflow-hidden">
                {allImages.length > 0 ? (
                  <>
                    <img
                      src={allImages[currentImageIndex]}
                      alt={productData.canonical_name}
                      className="w-full h-full object-cover"
                    />
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all duration-200"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all duration-200"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-gray-400">No Image Available</span>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {allImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {allImages.slice(0, 4).map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        currentImageIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${productData.canonical_name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Information */}
            <div className="space-y-6">
              {/* Product Header */}
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-2">
                  {productData.canonical_name}
                </h1>
                {currentVariant?.brand && (
                  <p className="text-lg text-gray-600 mb-2">
                    Brand: <span className="font-semibold">{currentVariant.brand}</span>
                  </p>
                )}
                {currentVariant?.grade && (
                  <p className="text-base text-gray-500">
                    Grade: {currentVariant.grade}
                  </p>
                )}
              </div>

              {/* Variant Selection */}
              {productData.variants.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Variants
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  >
                    {productData.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {[variant.brand, variant.grade, variant.size].filter(Boolean).join(' - ')}
                        {variant.pack_quantity && ` (${variant.pack_quantity} ${variant.pack_unit})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Price Display */}
              {bestPrice && (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-3xl font-bold text-blue-700">
                      {bestPrice.price_per_base_unit.toFixed(2)} {currency}
                    </span>
                    <span className="text-lg text-gray-600">per {productData.base_unit}</span>
                  </div>
                  
                  {bestPrice.promotional_price && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg text-gray-500 line-through">
                        {bestPrice.price.toFixed(2)} {currency}
                      </span>
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
                        SALE
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">
                        Best Price from {bestPrice.shop.name}
                      </span>
                    </div>
                    {savings > 0 && (
                      <span className="text-sm text-green-600 font-medium">
                        Save {savings.toFixed(2)} {currency}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity Calculator */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quantity Needed
                </label>
                <div className="flex items-center space-x-4 mb-4">
                  <button
                    onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center py-2 border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  />
                  <button
                    onClick={() => setSelectedQuantity(selectedQuantity + 1)}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    +
                  </button>
                  <span className="text-gray-600">{productData.base_unit}(s)</span>
                </div>

                {productData.waste_factor_percentage > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800">
                        Includes {productData.waste_factor_percentage}% waste factor
                      </span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">
                      Total needed: {(selectedQuantity * (1 + productData.waste_factor_percentage / 100)).toFixed(2)} {productData.base_unit}(s)
                    </p>
                  </div>
                )}

                {totalPrice > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">
                        Total Estimated Cost:
                      </span>
                      <span className="text-2xl font-bold text-blue-700">
                        {totalPrice.toFixed(2)} {currency}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleAddToBOM}
                  disabled={!isAuthenticated || !selectedVariantId}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add to BOM</span>
                  {currentBom.item_count > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {currentBom.item_count}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleAddToComparison}
                  disabled={!selectedVariantId}
                  className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <ArrowUpDown className="w-5 h-5" />
                  <span>Compare</span>
                  {activeComparison.product_ids.length > 0 && (
                    <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                      {activeComparison.product_ids.length}
                    </span>
                  )}
                </button>
              </div>

              {isAuthenticated && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link
                    to={`/rfq?product_id=${product_id}&variant_id=${selectedVariantId}&quantity=${selectedQuantity}`}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Request Quote</span>
                  </Link>

                  <button className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transition-all duration-200">
                    <Heart className="w-5 h-5" />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {[
                  { id: 'overview', name: 'Overview & Pricing', icon: ShoppingCart },
                  { id: 'specifications', name: 'Specifications', icon: AlertCircle },
                  { id: 'reviews', name: 'Reviews & Ratings', icon: Star },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Price Comparison Table */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Shop Comparison ({sortedPrices.length} shops available)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shop
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price per {productData.base_unit}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total ({selectedQuantity} {productData.base_unit}s)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Distance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedPrices.map((price, index) => (
                        <tr
                          key={price.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            index === 0 ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                          } ${
                            shopIdParam === price.shop.id ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {price.shop.name}
                                  </span>
                                  {price.shop.verified && (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  )}
                                  {index === 0 && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                      Best Price
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1 mt-1">
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3 h-3 ${
                                          i < Math.floor(price.shop.rating_average)
                                            ? 'text-yellow-400 fill-current'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    ({price.shop.rating_average.toFixed(1)})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {price.price_per_base_unit.toFixed(2)} {currency}
                            </div>
                            {price.promotional_price && (
                              <div className="text-xs text-green-600">
                                Sale: {price.promotional_price.toFixed(2)} {currency}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {(price.price_per_base_unit * selectedQuantity).toFixed(2)} {currency}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                price.inventory?.in_stock
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {price.inventory?.in_stock ? 'In Stock' : 'Out of Stock'}
                            </span>
                            {price.inventory?.lead_time_days && price.inventory.lead_time_days > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Lead time: {price.inventory.lead_time_days} days
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {price.distance_km ? (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {price.distance_km.toFixed(1)} km
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              {price.shop.phones.length > 0 && (
                                <a
                                  href={`tel:${price.shop.phones[0]}`}
                                  className="text-blue-600 hover:text-blue-700 p-1 rounded transition-colors"
                                  title="Call shop"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              )}
                              <Link
                                to={`/map?shop_id=${price.shop.id}&lat=${price.shop.location_lat}&lng=${price.shop.location_lng}`}
                                className="text-gray-600 hover:text-gray-700 p-1 rounded transition-colors"
                                title="View on map"
                              >
                                <MapPin className="w-4 h-4" />
                              </Link>
                              <Link
                                to={`/shops/${price.shop.id}`}
                                className="text-gray-600 hover:text-gray-700 p-1 rounded transition-colors"
                                title="Shop details"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sortedPrices.length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Prices Available</h3>
                    <p className="text-gray-500">
                      No shops have pricing information for this product yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'specifications' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Technical Specifications
              </h3>

              {productData.description && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-600 leading-relaxed">{productData.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Product Details</h4>
                  <dl className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm text-gray-600">Base Unit</dt>
                      <dd className="text-sm font-medium text-gray-900">{productData.base_unit}</dd>
                    </div>
                    {currentVariant?.brand && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <dt className="text-sm text-gray-600">Brand</dt>
                        <dd className="text-sm font-medium text-gray-900">{currentVariant.brand}</dd>
                      </div>
                    )}
                    {currentVariant?.grade && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <dt className="text-sm text-gray-600">Grade</dt>
                        <dd className="text-sm font-medium text-gray-900">{currentVariant.grade}</dd>
                      </div>
                    )}
                    {currentVariant?.size && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <dt className="text-sm text-gray-600">Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{currentVariant.size}</dd>
                      </div>
                    )}
                    {currentVariant?.pack_quantity && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <dt className="text-sm text-gray-600">Pack Size</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {currentVariant.pack_quantity} {currentVariant.pack_unit}
                        </dd>
                      </div>
                    )}
                    {productData.waste_factor_percentage > 0 && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <dt className="text-sm text-gray-600">Waste Factor</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {productData.waste_factor_percentage}%
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {(productData.specifications || currentVariant?.specifications) && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Technical Specifications</h4>
                    <dl className="space-y-3">
                      {Object.entries({
                        ...(productData.specifications || {}),
                        ...(currentVariant?.specifications || {}),
                      }).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                          <dt className="text-sm text-gray-600 capitalize">
                            {key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>

              {currentVariant?.sku && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">SKU</span>
                    <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {currentVariant.sku}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              {/* Reviews Summary */}
              {reviewsData?.rating_summary && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Reviews</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 mb-2">
                        {reviewsData.rating_summary.average_rating?.toFixed(1) || '0.0'}
                      </div>
                      <div className="flex items-center justify-center mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < Math.floor(reviewsData.rating_summary.average_rating || 0)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">
                        Based on {reviewsData.rating_summary.total_reviews || 0} reviews
                      </p>
                    </div>

                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <div key={rating} className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 w-8">{rating}★</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-400 h-2 rounded-full"
                              style={{
                                width: `${
                                  ((reviewsData.rating_summary.rating_distribution?.[rating] || 0) /
                                    (reviewsData.rating_summary.total_reviews || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-8">
                            {reviewsData.rating_summary.rating_distribution?.[rating] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Reviews */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-lg font-medium text-gray-900">All Reviews</h4>
                </div>

                {isReviewsLoading ? (
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : reviewsData?.reviews?.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {reviewsData.reviews.map((review: Review) => (
                      <div key={review.id} className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {review.user?.name?.charAt(0).toUpperCase() || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h5 className="text-sm font-medium text-gray-900">
                                {review.user?.name || 'Anonymous User'}
                              </h5>
                              {review.verified_purchase && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  Verified Purchase
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="flex items-center mb-2">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>

                            {review.review_text && (
                              <p className="text-gray-700 leading-relaxed mb-3">
                                {review.review_text}
                              </p>
                            )}

                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <button className="hover:text-gray-700">
                                Helpful ({review.helpful_votes})
                              </button>
                              <span>•</span>
                              <button className="hover:text-gray-700">Report</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Star className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
                    <p className="text-gray-500">
                      Be the first to review this product and help other buyers make informed decisions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Call to Action */}
          {!isAuthenticated && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-4">Get Full Access</h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Create an account to add products to your BOM, request quotes from suppliers, 
                and access advanced comparison tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register?redirect_to=/product"
                  className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Create Account
                </Link>
                <Link
                  to="/login?redirect_to=/product"
                  className="px-8 py-3 border border-white text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ProductDetails;