import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  ShareIcon, 
  DocumentDuplicateIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  CalculatorIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Types
interface BOMItem {
  id: string;
  bom_id: string;
  variant_id: string;
  quantity: number;
  unit: string;
  waste_factor: number;
  total_quantity_needed: number;
  estimated_price_per_unit: number | null;
  total_estimated_cost: number | null;
  notes: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  // Extended data from API
  variant?: {
    brand: string;
    grade: string;
    size: string;
  };
  product?: {
    canonical_name: string;
    base_unit: string;
  };
  best_prices?: Array<{
    shop_id: string;
    price: number;
    shop_name: string;
    verified: boolean;
  }>;
}

interface BOM {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  project_type: string | null;
  template: string | null;
  total_cost: number;
  item_count: number;
  status: 'draft' | 'active' | 'completed' | 'archived';
  shared_token: string | null;
  is_public: boolean;
  duplicate_source_id: string | null;
  created_at: number;
  updated_at: number;
  items?: BOMItem[];
}

interface CostAnalysis {
  total_cost: number;
  item_count: number;
  shop_breakdown: Array<{
    shop: {
      id: string;
      name: string;
    };
    total_cost: number;
    available_items: number;
    missing_items: number;
    delivery_fee: number;
  }>;
  optimization_suggestions: {
    cheapest_single_shop: {
      shop_id: string;
      total_cost: number;
      missing_items: string[];
    } | null;
    multi_shop_optimal: Array<{
      shop_id: string;
      items: string[];
      cost: number;
    }>;
  };
  missing_items: Array<{
    item_id: string;
    variant_id: string;
    product_name: string;
    alternatives: any[];
  }>;
}

const UV_BOMBuilder: React.FC = () => {
  const { bom_id } = useParams<{ bom_id?: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Zustand store selectors
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const userLocation = useAppStore(state => state.user_location);
  // const currentBomState = useAppStore(state => state.current_bom);
  // const loadBom = useAppStore(state => state.load_bom);
  // const createBom = useAppStore(state => state.create_bom);

  // Local state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCostAnalysis, setShowCostAnalysis] = useState(true);
  // const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // URL parameters
  const template = searchParams.get('template');
  const duplicateSource = searchParams.get('duplicate');

  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Load BOM data
  const { data: bomData, isLoading: isBomLoading, error: bomError } = useQuery({
    queryKey: ['bom', bom_id],
    queryFn: async (): Promise<BOM> => {
      if (!bom_id) {
        // Create new BOM if no ID provided
        const newBomData = {
          title: template ? `${template} Project` : 'New Project',
          description: '',
          project_type: template || null,
          template: template || null,
          duplicate_source_id: duplicateSource || null,
          is_public: false
        };
        
        const response = await axios.post(
          `${apiBaseUrl}/api/boms`,
          newBomData,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        return response.data;
      }

      const response = await axios.get(
        `${apiBaseUrl}/api/boms/${bom_id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000,
  });

  // Load cost analysis
  const { data: costAnalysis, isLoading: isCostLoading } = useQuery({
    queryKey: ['bom-cost-analysis', bomData?.id],
    queryFn: async (): Promise<CostAnalysis> => {
      if (!bomData?.id) return {
        total_cost: 0,
        item_count: 0,
        shop_breakdown: [],
        optimization_suggestions: {
          cheapest_single_shop: null,
          multi_shop_optimal: []
        },
        missing_items: []
      };

      const params = new URLSearchParams();
      if (userLocation.coordinates) {
        params.append('location_lat', userLocation.coordinates.lat.toString());
        params.append('location_lng', userLocation.coordinates.lng.toString());
      }
      params.append('include_delivery', 'true');

      const response = await axios.get(
        `${apiBaseUrl}/api/boms/${bomData.id}/cost-analysis?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    enabled: !!bomData?.id && !!authToken,
    staleTime: 2 * 60 * 1000,
  });

  // Update BOM mutation
  const updateBomMutation = useMutation({
    mutationFn: async (data: { title?: string; description?: string; status?: string }) => {
      if (!bomData?.id) throw new Error('No BOM selected');
      
      const response = await axios.put(
        `${apiBaseUrl}/api/boms/${bomData.id}`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', bom_id] });
    },
  });

  // Add BOM item mutation
  // const addItemMutation = useMutation({
//     mutationFn: async (itemData: {
//       variant_id: string;
//       quantity: number;
//       unit: string;
//       waste_factor?: number;
//       notes?: string;
//     }) => {
//       if (!bomData?.id) throw new Error('No BOM selected');
//       
//       const response = await axios.post(
//         `${apiBaseUrl}/api/boms/${bomData.id}/items`,
//         itemData,
//         { headers: { Authorization: `Bearer ${authToken}` } }
//       );
//       
//       return response.data;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['bom', bom_id] });
//       queryClient.invalidateQueries({ queryKey: ['bom-cost-analysis', bomData?.id] });
//       setShowAddItemModal(false);
//     },
//   });

  // Remove BOM item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!bomData?.id) throw new Error('No BOM selected');
      
      await axios.delete(
        `${apiBaseUrl}/api/boms/${bomData.id}/items/${itemId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', bom_id] });
      queryClient.invalidateQueries({ queryKey: ['bom-cost-analysis', bomData?.id] });
    },
  });

  // Share BOM mutation
  const shareBomMutation = useMutation({
    mutationFn: async (shareData: { is_public: boolean; expires_at?: number }) => {
      if (!bomData?.id) throw new Error('No BOM selected');
      
      const response = await axios.post(
        `${apiBaseUrl}/api/boms/${bomData.id}/share`,
        shareData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', bom_id] });
      setShowShareModal(false);
    },
  });

  // Handle title edit
  const handleTitleEdit = async () => {
    if (isEditingTitle && editedTitle.trim() && editedTitle !== bomData?.title) {
      await updateBomMutation.mutateAsync({ title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  // Handle item removal
  const handleRemoveItem = async (itemId: string) => {
    if (window.confirm('Are you sure you want to remove this item?')) {
      await removeItemMutation.mutateAsync(itemId);
    }
  };

  // Initialize edited title when BOM loads
  useEffect(() => {
    if (bomData?.title) {
      setEditedTitle(bomData.title);
    }
  }, [bomData?.title]);

  if (isBomLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading BOM...</p>
          </div>
        </div>
      </>
    );
  }

  if (bomError) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading BOM</h2>
            <p className="text-gray-600 mb-4">
              {bomError instanceof Error ? bomError.message : 'Failed to load BOM'}
            </p>
            <Link
              to="/bom-library"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to BOM Library
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!bomData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">No BOM data available</p>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={handleTitleEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleEdit();
                        if (e.key === 'Escape') {
                          setEditedTitle(bomData.title);
                          setIsEditingTitle(false);
                        }
                      }}
                      className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none min-w-0 flex-1"
                      autoFocus
                    />
                    <button
                      onClick={handleTitleEdit}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckIcon className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900 truncate">
                      {bomData.title}
                    </h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}
                
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span>
                    {bomData.item_count} {bomData.item_count === 1 ? 'item' : 'items'}
                  </span>
                  <span>•</span>
                  <span>
                    {costAnalysis ? `${costAnalysis.total_cost.toFixed(2)} AED` : 'Calculating...'}
                  </span>
                  <span>•</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    bomData.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    bomData.status === 'active' ? 'bg-blue-100 text-blue-800' :
                    bomData.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {bomData.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ShareIcon className="h-4 w-4 mr-2" />
                  Share
                </button>

                <Link
                  to={`/compare?bom_id=${bomData.id}`}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  Compare
                </Link>

                <Link
                  to={`/trip?bom_id=${bomData.id}`}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <TruckIcon className="h-4 w-4 mr-2" />
                  Plan Trip
                </Link>

                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* BOM Items */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Materials List
                  </h3>
                </div>

                {bomData.items && bomData.items.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {bomData.items.map((item) => (
                      <div key={item.id} className="p-6 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {item.product?.canonical_name || 'Unknown Product'}
                            </h4>
                            {item.variant && (
                              <p className="text-sm text-gray-500 mt-1">
                                {[item.variant.brand, item.variant.grade, item.variant.size]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            )}
                            
                            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                              <span>
                                Qty: {item.quantity} {item.unit}
                              </span>
                              {item.waste_factor > 0 && (
                                <span>
                                  Waste: {(item.waste_factor * 100).toFixed(1)}%
                                </span>
                              )}
                              <span>
                                Total: {item.total_quantity_needed} {item.unit}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="mt-2 text-sm text-gray-600 italic">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          <div className="ml-4 flex items-center space-x-2">
                            <div className="text-right">
                              {item.estimated_price_per_unit && (
                                <p className="text-sm font-medium text-gray-900">
                                  {item.estimated_price_per_unit.toFixed(2)} AED/{item.unit}
                                </p>
                              )}
                              {item.total_estimated_cost && (
                                <p className="text-lg font-semibold text-gray-900">
                                  {item.total_estimated_cost.toFixed(2)} AED
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {item.best_prices && item.best_prices.length > 0 && (
                          <div className="mt-4 bg-gray-50 rounded-md p-3">
                            <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                              Best Prices
                            </h5>
                            <div className="space-y-2">
                              {item.best_prices.slice(0, 3).map((price, priceIndex) => (
                                <div key={priceIndex} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-900">{price.shop_name}</span>
                                    {price.verified && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-900">
                                    {price.price.toFixed(2)} AED
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No items yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by adding your first material.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setShowAddItemModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add First Item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cost Analysis Sidebar */}
            <div className="space-y-6">
              {/* Cost Summary */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Cost Analysis</h3>
                  <button
                    onClick={() => setShowCostAnalysis(!showCostAnalysis)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <CalculatorIcon className="h-5 w-5" />
                  </button>
                </div>

                {isCostLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Calculating costs...</p>
                  </div>
                ) : costAnalysis ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold text-gray-900">
                        {costAnalysis.total_cost.toFixed(2)} AED
                      </div>
                      <p className="text-sm text-gray-500">Total estimated cost</p>
                    </div>

                    {costAnalysis.shop_breakdown.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Shop Breakdown</h4>
                        <div className="space-y-2">
                          {costAnalysis.shop_breakdown.slice(0, 3).map((shop, shopIndex) => (
                            <div key={shopIndex} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="text-gray-900">{shop.shop.name}</span>
                                <span className="text-gray-500 ml-1">
                                  ({shop.available_items}/{costAnalysis.item_count} items)
                                </span>
                              </div>
                              <span className="font-medium">
                                {shop.total_cost.toFixed(2)} AED
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {costAnalysis.optimization_suggestions.cheapest_single_shop && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <h4 className="text-sm font-medium text-green-800 mb-1">
                          Cheapest Single Shop
                        </h4>
                        <p className="text-sm text-green-700">
                          Save time by buying everything from one shop for{' '}
                          {costAnalysis.optimization_suggestions.cheapest_single_shop.total_cost.toFixed(2)} AED
                        </p>
                      </div>
                    )}

                    {costAnalysis.missing_items.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <h4 className="text-sm font-medium text-yellow-800 mb-1">
                          Missing Items
                        </h4>
                        <p className="text-sm text-yellow-700">
                          {costAnalysis.missing_items.length} items not available in nearby shops
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Cost analysis unavailable</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    to={`/rfq?bom_id=${bomData.id}`}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                    Request Quotes
                  </Link>

                  <button
                    onClick={() => setShowShareModal(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ShareIcon className="h-4 w-4 mr-2" />
                    Share BOM
                  </button>

                  <button
                    onClick={() => {
                      // Export functionality would go here
                      alert('Export functionality coming soon!');
                    }}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Item Modal */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Item to BOM</h3>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search for products
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for materials..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="text-center py-8 text-gray-500">
                  <p>Search integration would go here</p>
                  <p className="text-sm mt-2">
                    This would connect to the product search API
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAddItemModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Add item functionality would go here
                      setShowAddItemModal(false);
                    }}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Share BOM</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Make public</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Anyone with the link can view this BOM
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      shareBomMutation.mutate({ is_public: true });
                    }}
                    disabled={shareBomMutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {shareBomMutation.isPending ? 'Sharing...' : 'Create Share Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_BOMBuilder;