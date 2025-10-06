import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { Search, MapPin, Users, ShoppingCart, TrendingUp, Star, CheckCircle, ArrowRight, Building, Hammer, Home } from 'lucide-react';

// Interfaces for API responses
interface ProductVariant {
  id: string;
  product_id: string;
  brand: string | null;
  grade: string | null;
  image_url: string | null;
  created_at: number;
}

interface Shop {
  id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  verified: boolean;
  rating_average: number;
}

interface Category {
  id: string;
  name: string;
  category_path: string;
  image_url: string | null;
  sort_order: number;
}

interface PlatformStats {
  shop_count: number;
  product_count: number;
  user_count: number;
}

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Zustand selectors - individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const userLocation = useAppStore(state => state.user_location);
  const language = useAppStore(state => state.app_preferences.language);

  // API functions
  const fetchFeaturedProducts = async (): Promise<{ variants: ProductVariant[]; total: number }> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/product-variants`,
      {
        params: {
          limit: 8,
          is_active: true,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      }
    );
    return response.data;
  };

  const fetchFeaturedShops = async (): Promise<{ shops: Shop[]; total: number }> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops`,
      {
        params: {
          verified: true,
          limit: 6,
          sort_by: 'rating_average',
          sort_order: 'desc'
        }
      }
    );
    return response.data;
  };

  const fetchTopCategories = async (): Promise<{ categories: Category[] }> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/categories`,
      {
        params: {
          parent_id: null,
          is_active: true,
          sort_by: 'sort_order'
        }
      }
    );
    return response.data;
  };

  // Mock platform stats - in real implementation this would be an API call
  const mockPlatformStats: PlatformStats = {
    shop_count: 1250,
    product_count: 15000,
    user_count: 8500
  };

  // React Query hooks
  const { data: featuredProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: fetchFeaturedProducts,
    staleTime: 60000, // 1 minute
    retry: 1
  });

  const { data: featuredShops, isLoading: shopsLoading } = useQuery({
    queryKey: ['featured-shops'],
    queryFn: fetchFeaturedShops,
    staleTime: 60000,
    retry: 1
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['top-categories'],
    queryFn: fetchTopCategories,
    staleTime: 300000, // 5 minutes
    retry: 1
  });

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Search suggestions
  const searchSuggestions = [
    'cement 25kg',
    'steel bars 12mm',
    'ceramic tiles',
    'paint white',
    'electrical wire',
    'plumbing pipes'
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              {language === 'ar' ? 'منصة مواد البناء الذكية' : 'Smart Construction Materials Platform'}
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              {language === 'ar' 
                ? 'اعثر على أفضل الأسعار، قارن المتاجر، وأدر مشاريعك بكل سهولة'
                : 'Find the best prices, compare shops, and manage your construction projects with ease'
              }
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-12">
              <form onSubmit={handleSearch} className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 size-6" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'ابحث عن مواد البناء...' : 'Search for construction materials...'}
                    className="w-full pl-12 pr-32 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
                  >
                    {language === 'ar' ? 'بحث' : 'Search'}
                  </button>
                </div>
                
                {/* Search Suggestions */}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="text-sm text-gray-500 mr-2">
                    {language === 'ar' ? 'اقتراحات شائعة:' : 'Popular searches:'}
                  </span>
                  {searchSuggestions.slice(0, 4).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        navigate(`/search?q=${encodeURIComponent(suggestion)}`);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {/* User Location Display */}
            {userLocation.coordinates && (
              <div className="flex items-center justify-center text-sm text-gray-600 mb-8">
                <MapPin className="size-4 mr-2" />
                <span>
                  {userLocation.address || 
                    `${language === 'ar' ? 'موقعك الحالي' : 'Your location'}: ${userLocation.coordinates.lat.toFixed(2)}, ${userLocation.coordinates.lng.toFixed(2)}`
                  }
                </span>
              </div>
            )}

            {/* CTAs based on authentication */}
            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {language === 'ar' ? 'ابدأ مجاناً' : 'Get Started Free'}
                </Link>
                <Link
                  to="/login"
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/search"
                  className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                >
                  <Search className="size-5 mr-2" />
                  {language === 'ar' ? 'ابحث عن المواد' : 'Find Materials'}
                </Link>
                <Link
                  to="/bom"
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                >
                  <ShoppingCart className="size-5 mr-2" />
                  {language === 'ar' ? 'إدارة المشاريع' : 'Manage Projects'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* User Type Selection */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'مصمم لجميع احتياجاتك' : 'Built for Every Need'}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {language === 'ar' 
                ? 'سواء كنت مقاولاً أو صاحب منزل أو تاجر مواد بناء، لدينا الحل المناسب لك'
                : 'Whether you\'re a contractor, homeowner, or shop owner, we have the right solution for you'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-200">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Hammer className="size-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'المقاولون' : 'Contractors'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {language === 'ar' 
                    ? 'قارن الأسعار، أدر قوائم المواد، واحصل على عروض أسعار من عدة متاجر'
                    : 'Compare prices, manage material lists, and get quotes from multiple shops'
                  }
                </p>
                <Link
                  to="/register?user_type=buyer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-200">
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Home className="size-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'أصحاب المنازل' : 'Homeowners'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {language === 'ar' 
                    ? 'اعثر على أفضل العروض لمشاريع تحسين منزلك مع أدوات سهلة الاستخدام'
                    : 'Find the best deals for your home improvement projects with easy-to-use tools'
                  }
                </p>
                <Link
                  to="/register?user_type=buyer"
                  className="inline-flex items-center text-green-600 hover:text-green-800 font-medium transition-colors"
                >
                  {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-200">
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Building className="size-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'أصحاب المتاجر' : 'Shop Owners'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {language === 'ar' 
                    ? 'أدر مخزونك، استقبل طلبات عروض أسعار، وتواصل مع العملاء بسهولة'
                    : 'Manage inventory, receive quote requests, and connect with customers easily'
                  }
                </p>
                <Link
                  to="/register?user_type=seller"
                  className="inline-flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  {language === 'ar' ? 'انضم كتاجر' : 'Join as Seller'}
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Stats */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-blue-600 mb-2">
                {mockPlatformStats.shop_count.toLocaleString()}+
              </div>
              <div className="text-gray-600 font-medium">
                {language === 'ar' ? 'متجر موثق' : 'Verified Shops'}
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-blue-600 mb-2">
                {mockPlatformStats.product_count.toLocaleString()}+
              </div>
              <div className="text-gray-600 font-medium">
                {language === 'ar' ? 'منتج متاح' : 'Products Available'}
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-blue-600 mb-2">
                {mockPlatformStats.user_count.toLocaleString()}+
              </div>
              <div className="text-gray-600 font-medium">
                {language === 'ar' ? 'عميل راضٍ' : 'Happy Customers'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      {!categoriesLoading && categories && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {language === 'ar' ? 'تصفح حسب الفئة' : 'Browse by Category'}
              </h2>
              <p className="text-xl text-gray-600">
                {language === 'ar' ? 'اعثر على ما تحتاجه من فئات متنوعة' : 'Find what you need from diverse categories'}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {categories.categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.category_path}`}
                  className="group bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200 text-center"
                >
                  <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <TrendingUp className="size-8 text-gray-600 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {!productsLoading && featuredProducts && (
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {language === 'ar' ? 'المنتجات المميزة' : 'Featured Products'}
              </h2>
              <p className="text-xl text-gray-600">
                {language === 'ar' ? 'أحدث المنتجات المضافة من متاجرنا الموثقة' : 'Latest products from our verified suppliers'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.variants.slice(0, 8).map((product) => (
                <div key={product.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={`${product.brand || 'Product'} ${product.grade || ''}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400">
                        <TrendingUp className="size-12" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {product.brand || 'Product'} {product.grade && `- ${product.grade}`}
                    </h3>
                    <Link
                      to={`/product/${product.product_id}?variant=${product.id}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                      <ArrowRight className="size-4 ml-1" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/search"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {language === 'ar' ? 'عرض جميع المنتجات' : 'View All Products'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured Shops */}
      {!shopsLoading && featuredShops && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {language === 'ar' ? 'المتاجر الموثقة' : 'Trusted Suppliers'}
              </h2>
              <p className="text-xl text-gray-600">
                {language === 'ar' ? 'تسوق من أفضل المتاجر المعتمدة' : 'Shop from our top-rated verified suppliers'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredShops.shops.map((shop) => (
                <div key={shop.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="font-semibold text-gray-900 mr-2">{shop.name}</h3>
                        {shop.verified && (
                          <CheckCircle className="size-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex items-center text-gray-600 mb-2">
                        <MapPin className="size-4 mr-1" />
                        <span className="text-sm">
                          {language === 'ar' ? 'موقع معتمد' : 'Verified Location'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="flex items-center">
                          <Star className="size-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600 ml-1">
                            {shop.rating_average.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Link
                    to={`/shops/${shop.id}`}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {language === 'ar' ? 'زيارة المتجر' : 'Visit Shop'}
                    <ArrowRight className="size-4 ml-1" />
                  </Link>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                to="/map"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto w-fit"
              >
                <MapPin className="size-5 mr-2" />
                {language === 'ar' ? 'عرض الخريطة' : 'View on Map'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features Highlight */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'لماذا تختار منصتنا؟' : 'Why Choose Our Platform?'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <TrendingUp className="size-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'مقارنة الأسعار' : 'Price Comparison'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'قارن الأسعار من عدة متاجر في مكان واحد واحصل على أفضل العروض'
                    : 'Compare prices from multiple shops in one place and get the best deals'
                  }
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <ShoppingCart className="size-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'إدارة المشاريع' : 'Project Management'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'أنشئ قوائم مواد البناء وأدر مشاريعك بطريقة منظمة وفعالة'
                    : 'Create material lists and manage your construction projects efficiently'
                  }
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Users className="size-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'ar' ? 'شبكة موثقة' : 'Verified Network'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'تعامل مع متاجر موثقة ومعتمدة لضمان جودة الخدمة والمنتجات'
                    : 'Deal with verified and trusted suppliers for quality service and products'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      {!isAuthenticated && (
        <section className="py-16 lg:py-24 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              {language === 'ar' ? 'ابدأ رحلتك معنا اليوم' : 'Start Your Journey Today'}
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              {language === 'ar' 
                ? 'انضم إلى آلاف المستخدمين الذين يوفرون الوقت والمال مع منصتنا'
                : 'Join thousands of users who save time and money with our platform'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {language === 'ar' ? 'إنشاء حساب مجاني' : 'Create Free Account'}
              </Link>
              <Link
                to="/search"
                className="bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg border-2 border-blue-500 hover:bg-blue-800 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default UV_Landing;