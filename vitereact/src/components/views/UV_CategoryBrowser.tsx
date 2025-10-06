import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  ChevronRightIcon, 
  MagnifyingGlassIcon, 
  Squares2X2Icon, 
  ListBulletIcon,
  FunnelIcon,
  XMarkIcon,
  StarIcon,
  TagIcon,
  BuildingStorefrontIcon,
  EyeIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/main';

// Types based on Zod schemas
interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  category_path: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  children?: Category[];
  product_count?: number;
  popular?: boolean;
}

interface Product {
  id: string;
  canonical_name: string;
  category_id: string;
  subcategory: string | null;
  base_unit: string;
  description: string | null;
  image_url: string | null;
  waste_factor_percentage: number;
  is_active: boolean;
  variants?: ProductVariant[];
}

interface ProductVariant {
  id: string;
  product_id: string;
  brand: string | null;
  grade: string | null;
  size: string | null;
  pack_quantity: number | null;
  pack_unit: string | null;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

const UV_CategoryBrowser: React.FC = () => {
  const { category_path } = useParams<{ category_path?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Global state - using individual selectors to avoid infinite loops
  // const appPreferences = useAppStore(state => state.app_preferences);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const addToComparison = useAppStore(state => state.add_to_comparison);
  const addBomItem = useAppStore(state => state.add_bom_item);
  const currentBom = useAppStore(state => state.current_bom);

  // Local state
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (searchParams.get('view') as 'grid' | 'list') || 'grid'
  );
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');
  const [showFilters, setShowFilters] = useState(false);

  // API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Load category hierarchy
  const { data: categoryHierarchy, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ['categories', 'hierarchy'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/categories`, {
        params: {
          is_active: true,
          limit: 100,
          sort_by: 'sort_order',
          sort_order: 'asc'
        }
      });
      
      // Build hierarchical structure
      const buildHierarchy = (categories: Category[], parentId: string | null = null): Category[] => {
        return categories
          .filter(cat => cat.parent_id === parentId)
          .map(cat => ({
            ...cat,
            children: buildHierarchy(categories, cat.id),
            product_count: 0 // Will be populated from actual product counts
          }));
      };

      const hierarchy = buildHierarchy(response.data.categories);
      return {
        hierarchy,
        featured: response.data.categories
          .filter((cat: Category) => cat.parent_id === null)
          .slice(0, 8)
          .map((cat: Category) => ({ ...cat, popular: true }))
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });

  // Load current category details
  const { data: currentCategory, isLoading: isLoadingCurrentCategory } = useQuery({
    queryKey: ['category', selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return null;
      
      const response = await axios.get(`${API_BASE_URL}/api/categories/${selectedCategoryId}`);
      return response.data;
    },
    enabled: !!selectedCategoryId,
    staleTime: 5 * 60 * 1000
  });

  // Load products in current category
  const { data: categoryProducts, isLoading: isLoadingProducts, error: productsError } = useQuery({
    queryKey: ['products', 'category', selectedCategoryId, sortBy, categorySearchQuery],
    queryFn: async () => {
      if (!selectedCategoryId) return { products: [], total: 0 };
      
      const params: any = {
        category_id: selectedCategoryId,
        is_active: true,
        sort_by: sortBy,
        sort_order: 'asc',
        limit: 20,
        offset: 0
      };

      if (categorySearchQuery.trim()) {
        params.query = categorySearchQuery.trim();
      }

      const response = await axios.get(`${API_BASE_URL}/api/products`, { params });
      return response.data;
    },
    enabled: !!selectedCategoryId,
    staleTime: 2 * 60 * 1000
  });

  // Build breadcrumb trail
  const breadcrumbTrail = useMemo((): BreadcrumbItem[] => {
    if (!currentCategory || !categoryHierarchy?.hierarchy) return [];

    const buildBreadcrumbs = (category: Category, allCategories: Category[]): BreadcrumbItem[] => {
      const breadcrumbs: BreadcrumbItem[] = [];
      let current = category;
      
      while (current) {
        breadcrumbs.unshift({
          id: current.id,
          name: current.name,
          path: current.category_path
        });
        
        // Find parent in flat list
        const findInHierarchy = (cats: Category[], id: string): Category | null => {
          for (const cat of cats) {
            if (cat.id === id) return cat;
            if (cat.children) {
              const found = findInHierarchy(cat.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        
        current = current.parent_id ? findInHierarchy(allCategories, current.parent_id) : null;
      }
      
      return breadcrumbs;
    };

    return buildBreadcrumbs(currentCategory || undefined, categoryHierarchy.hierarchy);
  }, [currentCategory, categoryHierarchy]);

  // Handle category path changes from URL
  useEffect(() => {
    if (category_path && categoryHierarchy?.hierarchy) {
      // Find category by path
      const findCategoryByPath = (cats: Category[], path: string): Category | null => {
        for (const cat of cats) {
          if (cat.category_path === path) return cat;
          if (cat.children) {
            const found = findCategoryByPath(cat.children, path);
            if (found) return found;
          }
        }
        return null;
      };

      const foundCategory = findCategoryByPath(categoryHierarchy.hierarchy, category_path);
      if (foundCategory) {
        setSelectedCategoryId(foundCategory.id);
      }
    } else {
      setSelectedCategoryId(null);
    }
  }, [category_path, categoryHierarchy]);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (sortBy !== 'name') newParams.set('sort', sortBy);
    if (viewMode !== 'grid') newParams.set('view', viewMode);
    setSearchParams(newParams);
  }, [sortBy, viewMode, setSearchParams]);

  // Handle category navigation
  const handleCategoryClick = (category: Category) => {
    navigate(`/categories/${category.category_path}`);
  };

  // Handle search within category
  const handleCategorySearch = (query: string) => {
    setCategorySearchQuery(query);
  };

  // Add to comparison
  const handleAddToComparison = (variantId: string) => {
    addToComparison(variantId);
  };

  // Add to BOM
  const handleAddToBOM = async (variantId: string) => {
    if (!currentBom.id) {
      // TODO: Show modal to create BOM first
      return;
    }
    
    try {
      await addBomItem({
        variant_id: variantId,
        quantity: 1,
        unit: 'piece',
        waste_factor: 0
      });
    } catch (error) {
      console.error('Failed to add to BOM:', error);
    }
  };

  // Render category card
  const renderCategoryCard = (category: Category) => (
    <div
      key={category.id}
      onClick={() => handleCategoryClick(category)}
      className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden border border-gray-100"
    >
      <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-blue-50 to-indigo-100">
        {category.image_url ? (
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-32 flex items-center justify-center">
            <TagIcon className="h-12 w-12 text-blue-500" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {category.name}
          </h3>
          {category.popular && (
            <StarIcon className="h-5 w-5 text-yellow-400 fill-current" />
          )}
        </div>
        
        {category.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {category.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            {category.product_count || 0} products
          </span>
          <ChevronRightIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </div>
  );

  // Render product card
  const renderProductCard = (product: Product) => (
    <div key={product.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="aspect-w-16 aspect-h-9 bg-gray-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.canonical_name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center">
            <BuildingStorefrontIcon className="h-16 w-16 text-gray-300" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {product.canonical_name}
        </h3>
        
        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>Unit: {product.base_unit}</span>
          {product.waste_factor_percentage > 0 && (
            <span>Waste: {product.waste_factor_percentage}%</span>
          )}
        </div>
        
        <div className="flex gap-2">
          <Link
            to={`/product/${product.id}`}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <EyeIcon className="h-4 w-4" />
            View Details
          </Link>
          
          {isAuthenticated && (
            <>
              <button
                onClick={() => handleAddToComparison(product.variants?.[0]?.id || product.id)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                title="Add to comparison"
              >
                <FunnelIcon className="h-4 w-4" />
              </button>
              
              {currentBom.id && (
                <button
                  onClick={() => handleAddToBOM(product.variants?.[0]?.id || product.id)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  title="Add to BOM"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {currentCategory ? currentCategory.name : 'Browse Categories'}
                </h1>
                
                {/* Breadcrumb */}
                {breadcrumbTrail.length > 0 && (
                  <nav className="flex items-center space-x-2 mt-2" aria-label="Breadcrumb">
                    <Link
                      to="/categories"
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      All Categories
                    </Link>
                    {breadcrumbTrail.map((crumb, index) => (
                      <React.Fragment key={crumb.id}>
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                        {index === breadcrumbTrail.length - 1 ? (
                          <span className="text-sm font-medium text-gray-900">
                            {crumb.name}
                          </span>
                        ) : (
                          <Link
                            to={`/categories/${crumb.path}`}
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            {crumb.name}
                          </Link>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                )}
              </div>

              {/* Search and filters */}
              {selectedCategoryId && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search in category..."
                      value={categorySearchQuery}
                      onChange={(e) => handleCategorySearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FunnelIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Filters bar */}
            {selectedCategoryId && showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort by
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="canonical_name">Name</option>
                      <option value="created_at">Newest</option>
                      <option value="category_id">Category</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      View
                    </label>
                    <div className="flex border border-gray-300 rounded-md">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'} transition-colors`}
                      >
                        <Squares2X2Icon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'} transition-colors`}
                      >
                        <ListBulletIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading states */}
          {(isLoadingCategories || isLoadingCurrentCategory || isLoadingProducts) && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Error states */}
          {(categoriesError || productsError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p>Failed to load content. Please try again later.</p>
            </div>
          )}

          {/* Show categories if no specific category selected */}
          {!selectedCategoryId && !isLoadingCategories && categoryHierarchy && (
            <div>
              {/* Featured categories */}
              {categoryHierarchy.featured.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Categories</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categoryHierarchy.featured.map(renderCategoryCard)}
                  </div>
                </div>
              )}

              {/* All categories */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">All Categories</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryHierarchy.hierarchy.map(renderCategoryCard)}
                </div>
              </div>
            </div>
          )}

          {/* Show subcategories and products for selected category */}
          {selectedCategoryId && currentCategory && !isLoadingCurrentCategory && (
            <div>
              {/* Subcategories */}
              {currentCategory.children && currentCategory.children.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Subcategories</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {currentCategory.children.map(renderCategoryCard)}
                  </div>
                </div>
              )}

              {/* Products */}
              {!isLoadingProducts && categoryProducts && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Products ({categoryProducts.total || 0})
                    </h2>
                  </div>

                  {categoryProducts.products.length > 0 ? (
                    <div className={`grid gap-6 ${
                      viewMode === 'grid' 
                        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                        : 'grid-cols-1'
                    }`}>
                      {categoryProducts.products.map(renderProductCard)}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <TagIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                      <p className="text-gray-600">
                        {categorySearchQuery 
                          ? `No products match "${categorySearchQuery}" in this category.`
                          : 'This category doesn\'t have any products yet.'
                        }
                      </p>
                      {categorySearchQuery && (
                        <button
                          onClick={() => setCategorySearchQuery('')}
                          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state for no categories */}
          {!isLoadingCategories && !categoryHierarchy?.hierarchy.length && (
            <div className="text-center py-12">
              <TagIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories available</h3>
              <p className="text-gray-600">Categories will appear here when they're added to the system.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CategoryBrowser;