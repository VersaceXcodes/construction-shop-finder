import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Icons (using simple SVG paths for reliability)
const BOMIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

const ShareIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

interface BOMCostAnalysis {
  total_cost: number;
  item_count: number;
  optimization_suggestions?: {
    multi_shop_optimal?: Array<{
      savings: number;
    }>;
  };
}

interface BOMItemResponse {
  id: string;
  variant_id: string;
  quantity: number;
  unit: string;
  total_quantity_needed: number;
  created_at: number;
  updated_at: number;
}

interface BOMUpdateResponse {
  updated_total_cost: number;
  updated_at: number;
  item?: BOMItemResponse;
}

const GV_BOMQuickAccess: React.FC = () => {
  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Global state - using individual selectors to prevent infinite loops
  const currentBOM = useAppStore(state => state.current_bom);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.app_preferences.currency);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  
  // Global actions
  const createBOM = useAppStore(state => state.create_bom);

  const queryClient = useQueryClient();

  // Only show widget if user is authenticated and not on certain views
  if (!isAuthenticated || !currentBOM) {
    return null;
  }

  // BOM cost analysis query
  const { data: costAnalysis, isLoading: isLoadingCosts } = useQuery<BOMCostAnalysis>({
    queryKey: ['bom-cost-analysis', currentBOM.id],
    queryFn: async () => {
      if (!currentBOM.id || !authToken) return null;
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${currentBOM.id}/cost-analysis`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { include_delivery: false }
        }
      );
      return response.data;
    },
    enabled: !!currentBOM.id && !!authToken,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });



  // Remove last item mutation
  const removeLastItemMutation = useMutation<BOMUpdateResponse, Error>({
    mutationFn: async () => {
      if (!currentBOM.id || !authToken || currentBOM.items.length === 0) {
        throw new Error('No items to remove');
      }

      const lastItem = currentBOM.items[currentBOM.items.length - 1];
      
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${currentBOM.id}/items/${lastItem.id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update global state
      const updatedItems = currentBOM.items.slice(0, -1);
      
      useAppStore.setState(state => ({
        current_bom: {
          ...state.current_bom,
          items: updatedItems,
          item_count: Math.max(0, state.current_bom.item_count - 1),
          total_cost: data.updated_total_cost,
          last_updated: new Date(data.updated_at).toISOString()
        }
      }));
      
      // Invalidate cost analysis
      queryClient.invalidateQueries({ queryKey: ['bom-cost-analysis'] });
    },
  });

  // Create new BOM if none exists
  const createBOMMutation = useMutation({
    mutationFn: async () => {
      if (!authToken) throw new Error('Authentication required');
      
      await createBOM({
        title: 'New Project',
        description: 'Created from quick access',
        is_public: false
      });
    },
  });

  // Handle remove last item
  const handleRemoveLastItem = () => {
    if (currentBOM.items.length > 0) {
      removeLastItemMutation.mutate();
    }
  };

  // Handle create BOM if none exists
  const handleCreateBOM = () => {
    createBOMMutation.mutate();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate estimated savings
  const estimatedSavings = costAnalysis?.optimization_suggestions?.multi_shop_optimal?.reduce(
    (acc, shop) => acc + (shop.savings || 0), 0
  ) || null;

  return (
    <>
      {/* Floating BOM Quick Access Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        {/* Expanded Preview Panel */}
        {isExpanded && (
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 mb-2 transform transition-all duration-300 ease-out">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {currentBOM.title || 'Current BOM'}
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronDownIcon />
              </button>
            </div>

            {/* Cost Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-600">Total Cost</p>
                  <p className="text-lg font-bold text-gray-900">
                    {isLoadingCosts ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      formatCurrency(costAnalysis?.total_cost || currentBOM.total_cost)
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Items</p>
                  <p className="text-lg font-bold text-blue-600">
                    {currentBOM.item_count}
                  </p>
                </div>
              </div>
              
              {estimatedSavings && estimatedSavings > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-100">
                  <p className="text-xs text-green-600">
                    Potential savings: {formatCurrency(estimatedSavings)}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Items */}
            {currentBOM.items.length > 0 ? (
              <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                {currentBOM.items.slice(-3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 truncate">Item {item.variant_id.slice(-6)}</p>
                      <p className="text-gray-500">{item.quantity} {item.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No items in BOM yet
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <button
                onClick={handleRemoveLastItem}
                disabled={currentBOM.items.length === 0 || removeLastItemMutation.isPending}
                className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {removeLastItemMutation.isPending ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                ) : (
                  <>
                    <MinusIcon />
                    <span className="ml-1">Remove</span>
                  </>
                )}
              </button>
              
              <Link
                to={`/bom/${currentBOM.id}`}
                className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                View Full
              </Link>
              
              <button
                onClick={() => setShowActions(!showActions)}
                className="flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ShareIcon />
              </button>
            </div>
          </div>
        )}

        {/* Main Floating Button */}
        <div className="relative">
          {currentBOM.id ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <BOMIcon />
              
              {/* Item Count Badge */}
              {currentBOM.item_count > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
                  {currentBOM.item_count > 99 ? '99+' : currentBOM.item_count}
                </div>
              )}
              
              {/* Expand/Collapse Indicator */}
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-lg">
                {isExpanded ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronUpIcon />
                )}
              </div>
            </button>
          ) : (
            // Create BOM Button
            <button
              onClick={handleCreateBOM}
              disabled={createBOMMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-100 disabled:opacity-50"
            >
              {createBOMMutation.isPending ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <PlusIcon />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_BOMQuickAccess;