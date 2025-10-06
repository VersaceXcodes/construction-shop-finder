import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { Package2, CheckCircle2, Star, Clock, MessageCircle, AlertTriangle,  MapPin, Calendar, DollarSign, Send, Paperclip, Truck, FileText, Edit, X, ChevronRight, ChevronLeft } from 'lucide-react';

// TypeScript interfaces
interface RFQ {
  id: string;
  user_id: string;
  bom_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: number | null;
  delivery_location_lat: number | null;
  delivery_location_lng: number | null;
  delivery_address: string | null;
  special_requirements: string | null;
  budget_limit: number | null;
  responses_count: number;
  created_at: number;
  updated_at: number;
  bom?: {
    title: string;
    item_count: number;
    items?: BOMItem[];
  };
  replies?: RFQReply[];
}

interface BOMItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit: string;
  waste_factor: number;
  total_quantity_needed: number;
  notes: string | null;
  variant: {
    brand: string | null;
    grade: string | null;
    size: string | null;
  };
  product: {
    canonical_name: string;
    base_unit: string;
  };
}

interface RFQMessage {
  id: string;
  rfq_id: string;
  sender_id: string;
  message: string;
  message_type: 'text' | 'image' | 'document';
  attachments: any[];
  read_at: number | null;
  created_at: number;
  sender: {
    id: string;
    name: string;
    user_type: string;
    shop_name?: string;
  };
}

interface RFQReply {
  id: string;
  rfq_id: string;
  shop_id: string;
  total_price: number;
  delivery_fee: number;
  delivery_days: number;
  notes: string | null;
  terms_conditions: string | null;
  valid_until: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  line_items: LineItem[];
  created_at: number;
  updated_at: number;
  shop: {
    id: string;
    name: string;
    verified: boolean;
    rating_average: number;
    location_lat: number;
    location_lng: number;
  };
}

interface LineItem {
  variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}


const UV_RFQInbox: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global state - individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Local state
  const [selectedRFQId, setSelectedRFQId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isPreparingQuote, setIsPreparingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState({
    total_price: 0,
    delivery_fee: 0,
    delivery_days: 0,
    notes: '',
    terms_conditions: '',
    valid_until: null as number | null,
    line_items: [] as LineItem[]
  });
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // URL parameters
  const statusFilter = searchParams.get('status') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const shopIdFilter = searchParams.get('shop_id') || '';

  // API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Load user's RFQs
  const { data: rfqsData, isLoading: loadingRFQs, error: rfqsError } = useQuery({
    queryKey: ['rfqs', statusFilter, priorityFilter, shopIdFilter, currentUser?.id],
    queryFn: async () => {
      if (!authToken || !currentUser) throw new Error('Authentication required');
      
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (shopIdFilter) params.append('shop_id', shopIdFilter);
      params.append('limit', '50');
      params.append('sort_by', 'created_at');
      params.append('sort_order', 'desc');

      const response = await axios.get(
        `${apiBaseUrl}/api/rfqs?${params.toString()}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // Filter RFQs based on user type
      let filteredRFQs = response.data.rfqs;
      if (currentUser.user_type === 'buyer') {
        filteredRFQs = filteredRFQs.filter((rfq: RFQ) => rfq.user_id === currentUser.id);
      } else if (currentUser.user_type === 'seller') {
        // For shop owners, show RFQs in their delivery area
        // This would require shop profile data with location/delivery radius
        // For now, showing all RFQs they have access to
        filteredRFQs = filteredRFQs;
      }

      return { rfqs: filteredRFQs, total: filteredRFQs.length };
    },
    enabled: !!authToken && !!currentUser,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Load selected RFQ details
  const { data: selectedRFQ, isLoading: loadingRFQDetail } = useQuery({
    queryKey: ['rfq-detail', selectedRFQId],
    queryFn: async () => {
      if (!authToken || !selectedRFQId) throw new Error('Authentication and RFQ ID required');
      
      const response = await axios.get(
        `${apiBaseUrl}/api/rfqs/${selectedRFQId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    enabled: !!authToken && !!selectedRFQId,
    staleTime: 10000, // 10 seconds
  });

  // Load RFQ messages
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['rfq-messages', selectedRFQId],
    queryFn: async () => {
      if (!authToken || !selectedRFQId) throw new Error('Authentication and RFQ ID required');
      
      const response = await axios.get(
        `${apiBaseUrl}/api/rfqs/${selectedRFQId}/messages?limit=100&offset=0`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data.messages.map((msg: any) => ({
        ...msg,
        sender_name: msg.sender.name,
        is_from_current_user: msg?.sender_id === currentUser?.id
      }));
    },
    enabled: !!authToken && !!selectedRFQId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Load shop inventory for quote preparation
  const { data: inventoryData } = useQuery({
    queryKey: ['shop-inventory', selectedRFQId, currentUser?.id],
    queryFn: async () => {
      if (!authToken || !selectedRFQId || currentUser?.user_type !== 'seller') {
        return {};
      }
      
      // Get variant IDs from selected RFQ BOM
      if (!selectedRFQ?.bom?.items) return {};
      
      const variantIds = selectedRFQ.bom.items.map((item: BOMItem) => item.variant_id);
      const params = new URLSearchParams();
      params.append('shop_id', currentUser.id); // Assuming user ID = shop ID for sellers
      variantIds.forEach(id => params.append('variant_id', id));
      
      const response = await axios.get(
        `${apiBaseUrl}/api/inventory?${params.toString()}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      // Transform to variant_id -> inventory mapping
      return response.data.inventory.reduce((acc: any, item: any) => ({
        ...acc,
        [item.variant_id]: {
          in_stock: item.in_stock,
          available_quantity: item.stock_quantity,
          lead_time_days: item.lead_time_days,
          unit_price: item.price?.price || 0
        }
      }), {});
    },
    enabled: !!authToken && !!selectedRFQId && !!selectedRFQ && currentUser?.user_type === 'seller',
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ rfqId, message, messageType = 'text', attachments = [] }: {
      rfqId: string;
      message: string;
      messageType?: string;
      attachments?: any[];
    }) => {
      if (!authToken) throw new Error('Authentication required');
      
      const response = await axios.post(
        `${apiBaseUrl}/api/rfqs/${rfqId}/messages`,
        { message, message_type: messageType, attachments },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq-messages', selectedRFQId] });
      setMessageText('');
    },
  });

  // Submit quote response mutation
  const submitQuoteMutation = useMutation({
    mutationFn: async (quoteData: any) => {
      if (!authToken || !selectedRFQId) throw new Error('Authentication and RFQ ID required');
      
      const response = await axios.post(
        `${apiBaseUrl}/api/rfqs/${selectedRFQId}/replies`,
        quoteData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq-detail', selectedRFQId] });
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setIsPreparingQuote(false);
      setQuoteData({
        total_price: 0,
        delivery_fee: 0,
        delivery_days: 0,
        notes: '',
        terms_conditions: '',
        valid_until: null,
        line_items: []
      });
    },
  });

  // Initialize quote preparation when RFQ is selected
  useEffect(() => {
    if (selectedRFQ?.bom?.items && currentUser?.user_type === 'seller' && isPreparingQuote) {
      const lineItems = selectedRFQ.bom.items.map((item: BOMItem) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: inventoryData?.[item.variant_id]?.unit_price || 0,
        total_price: 0,
        notes: null
      }));
      
      setQuoteData(prev => ({
        ...prev,
        line_items: lineItems
      }));
    }
  }, [selectedRFQ, inventoryData, isPreparingQuote, currentUser?.user_type]);

  // Calculate total price when line items change
  useEffect(() => {
    if (quoteData.line_items.length > 0) {
      const subtotal = quoteData.line_items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unit_price;
        return sum + itemTotal;
      }, 0);
      
      setQuoteData(prev => ({
        ...prev,
        total_price: subtotal + prev.delivery_fee,
        line_items: prev.line_items.map(item => ({
          ...item,
          total_price: item.quantity * item.unit_price
        }))
      }));
    }
  }, [quoteData.line_items.map(item => `${item.unit_price}-${item.quantity}`).join(','), quoteData.delivery_fee]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  // Handle RFQ selection
  const handleSelectRFQ = (rfqId: string) => {
    setSelectedRFQId(rfqId);
    setShowMobileDetail(true);
    setIsPreparingQuote(false);
  };

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedRFQId) return;
    
    sendMessageMutation.mutate({
      rfqId: selectedRFQId,
      message: messageText.trim()
    });
  };

  // Handle quote submission
  const handleSubmitQuote = () => {
    if (!selectedRFQId || quoteData.line_items.length === 0) return;
    
    submitQuoteMutation.mutate(quoteData);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-blue-600 bg-blue-100';
      case 'active': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!currentUser) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">Please log in to access the RFQ inbox.</p>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile back button */}
        <div className="md:hidden fixed top-4 left-4 z-10">
          {showMobileDetail && (
            <button
              onClick={() => setShowMobileDetail(false)}
              className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* RFQ List Sidebar */}
        <div className={`${showMobileDetail ? 'hidden' : 'block'} md:block w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 flex flex-col`}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {currentUser.user_type === 'buyer' ? 'My Requests' : 'Quote Requests'}
              </h1>
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            
            {/* Filters */}
            <div className="space-y-3">
              <div className="flex space-x-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams);
                    if (e.target.value) {
                      params.set('status', e.target.value);
                    } else {
                      params.delete('status');
                    }
                    setSearchParams(params);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams);
                    if (e.target.value) {
                      params.set('priority', e.target.value);
                    } else {
                      params.delete('priority');
                    }
                    setSearchParams(params);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* RFQ List */}
          <div className="flex-1 overflow-y-auto">
            {loadingRFQs ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
                  ))}
                </div>
              </div>
            ) : rfqsError ? (
              <div className="p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium">Failed to load RFQs</p>
                <p className="text-gray-500 text-sm">Please try again later</p>
              </div>
            ) : !rfqsData?.rfqs?.length ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No RFQs found</h3>
                <p className="text-gray-500 text-sm">
                  {currentUser.user_type === 'buyer' 
                    ? 'You haven\'t sent any quote requests yet.'
                    : 'No quote requests match your current filters.'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {rfqsData.rfqs.map((rfq: RFQ) => (
                  <div
                    key={rfq.id}
                    onClick={() => handleSelectRFQ(rfq.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedRFQId === rfq.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 truncate flex-1 mr-2">
                        {rfq.title}
                      </h3>
                      <div className="flex items-center space-x-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(rfq.priority)}`}>
                          {rfq.priority}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(rfq.status)}`}>
                        {rfq.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {rfq.responses_count} response{rfq.responses_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {rfq.bom && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Package2 className="w-3 h-3 mr-1" />
                        {rfq.bom.title} ({rfq.bom.item_count} items)
                      </div>
                    )}
                    
                    {rfq.deadline && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Clock className="w-3 h-3 mr-1" />
                        Due: {formatDate(rfq.deadline)}
                      </div>
                    )}
                    
                    {rfq.budget_limit && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <DollarSign className="w-3 h-3 mr-1" />
                        Budget: {formatCurrency(rfq.budget_limit)}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {formatDate(rfq.created_at)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RFQ Detail View */}
        <div className={`${showMobileDetail ? 'block' : 'hidden'} md:block flex-1 flex flex-col bg-white`}>
          {selectedRFQId ? (
            loadingRFQDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedRFQ ? (
              <>
                {/* RFQ Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {selectedRFQ.title}
                      </h2>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedRFQ.status)}`}>
                          {selectedRFQ.status}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedRFQ.priority)}`}>
                          {selectedRFQ.priority} priority
                        </span>
                        <span>Created {formatDate(selectedRFQ.created_at)}</span>
                      </div>
                    </div>
                    
                    {currentUser.user_type === 'seller' && selectedRFQ.status === 'pending' && (
                      <button
                        onClick={() => setIsPreparingQuote(!isPreparingQuote)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          isPreparingQuote
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isPreparingQuote ? (
                          <>
                            <X className="w-4 h-4 inline mr-2" />
                            Cancel Quote
                          </>
                        ) : (
                          <>
                            <Edit className="w-4 h-4 inline mr-2" />
                            Prepare Quote
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {selectedRFQ.description && (
                    <p className="text-gray-600 mb-4">{selectedRFQ.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {selectedRFQ.deadline && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span>Deadline: {formatDate(selectedRFQ.deadline)}</span>
                      </div>
                    )}
                    
                    {selectedRFQ.budget_limit && (
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                        <span>Budget: {formatCurrency(selectedRFQ.budget_limit)}</span>
                      </div>
                    )}
                    
                    {selectedRFQ.delivery_address && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="truncate">{selectedRFQ.delivery_address}</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedRFQ.special_requirements && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-1">Special Requirements:</h4>
                      <p className="text-yellow-700 text-sm">{selectedRFQ.special_requirements}</p>
                    </div>
                  )}
                </div>

                {/* Quote Preparation Interface (Shop Owners Only) */}
                {isPreparingQuote && currentUser.user_type === 'seller' && (
                  <div className="p-6 bg-blue-50 border-b border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">
                      <Edit className="w-5 h-5 inline mr-2" />
                      Prepare Quote
                    </h3>
                    
                    {/* Line Items */}
                    {selectedRFQ.bom?.items && (
                      <div className="space-y-4 mb-6">
                        <h4 className="font-medium text-blue-800">Items Required:</h4>
                        <div className="bg-white rounded-lg overflow-hidden">
                          <div className="grid grid-cols-6 gap-4 p-3 bg-gray-50 text-sm font-medium text-gray-700">
                            <div className="col-span-2">Product</div>
                            <div>Quantity</div>
                            <div>Unit Price</div>
                            <div>Total</div>
                            <div>Stock</div>
                          </div>
                          
                          {selectedRFQ.bom.items.map((item: BOMItem, index: number) => {
                            const lineItem = quoteData.line_items.find(li => li.variant_id === item.variant_id);
                            const inventory = inventoryData?.[item.variant_id];
                            
                            return (
                              <div key={item.id} className="grid grid-cols-6 gap-4 p-3 border-t border-gray-200">
                                <div className="col-span-2">
                                  <div className="font-medium text-gray-900">
                                    {item.product.canonical_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {item.variant.brand} {item.variant.grade} {item.variant.size}
                                  </div>
                                </div>
                                
                                <div className="text-sm">
                                  {item.quantity} {item.unit}
                                </div>
                                
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={lineItem?.unit_price || 0}
                                    onChange={(e) => {
                                      const newPrice = parseFloat(e.target.value) || 0;
                                      setQuoteData(prev => ({
                                        ...prev,
                                        line_items: prev.line_items.map(li =>
                                          li.variant_id === item.variant_id
                                            ? { ...li, unit_price: newPrice }
                                            : li
                                        )
                                      }));
                                    }}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="0.00"
                                  />
                                </div>
                                
                                <div className="font-medium">
                                  {formatCurrency(lineItem?.total_price || 0)}
                                </div>
                                
                                <div>
                                  {inventory ? (
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      inventory.in_stock 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {inventory.in_stock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">Checking...</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Quote Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">
                            Delivery Fee
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={quoteData.delivery_fee}
                            onChange={(e) => setQuoteData(prev => ({ 
                              ...prev, 
                              delivery_fee: parseFloat(e.target.value) || 0 
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">
                            Delivery Days
                          </label>
                          <input
                            type="number"
                            value={quoteData.delivery_days}
                            onChange={(e) => setQuoteData(prev => ({ 
                              ...prev, 
                              delivery_days: parseInt(e.target.value) || 0 
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={quoteData.notes}
                            onChange={(e) => setQuoteData(prev => ({ 
                              ...prev, 
                              notes: e.target.value 
                            }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Additional notes..."
                          />
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <div className="text-lg font-semibold text-blue-900">
                            Total Quote: {formatCurrency(quoteData.total_price)}
                          </div>
                          <div className="text-sm text-blue-700 mt-1">
                            Items: {formatCurrency(quoteData.total_price - quoteData.delivery_fee)} + 
                            Delivery: {formatCurrency(quoteData.delivery_fee)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => setIsPreparingQuote(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitQuote}
                        disabled={submitQuoteMutation.isPending || quoteData.line_items.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitQuoteMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 inline mr-2" />
                            Submit Quote
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* BOM Details */}
                {selectedRFQ.bom && !isPreparingQuote && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      <Package2 className="w-5 h-5 inline mr-2" />
                      Bill of Materials: {selectedRFQ.bom.title}
                    </h3>
                    
                    {selectedRFQ.bom.items && (
                      <div className="bg-gray-50 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-4 gap-4 p-3 bg-gray-100 text-sm font-medium text-gray-700">
                          <div className="col-span-2">Product</div>
                          <div>Quantity</div>
                          <div>Notes</div>
                        </div>
                        
                        {selectedRFQ.bom.items.map((item: BOMItem) => (
                          <div key={item.id} className="grid grid-cols-4 gap-4 p-3 border-t border-gray-200">
                            <div className="col-span-2">
                              <div className="font-medium text-gray-900">
                                {item.product.canonical_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.variant.brand} {item.variant.grade} {item.variant.size}
                              </div>
                            </div>
                            <div className="text-sm">
                              {item.quantity} {item.unit}
                              {item.waste_factor > 0 && (
                                <div className="text-xs text-gray-400">
                                  +{item.waste_factor}% waste
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {item.notes || '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Replies */}
                {selectedRFQ.replies && selectedRFQ.replies.length > 0 && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      <FileText className="w-5 h-5 inline mr-2" />
                      Quotes Received ({selectedRFQ.replies.length})
                    </h3>
                    
                    <div className="space-y-4">
                      {selectedRFQ.replies.map((reply: RFQReply) => (
                        <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900 flex items-center">
                                {reply.shop.name}
                                {reply.shop.verified && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-2" />
                                )}
                              </h4>
                              <div className="flex items-center text-sm text-gray-500 mt-1">
                                <Star className="w-3 h-3 text-yellow-400 mr-1" />
                                {reply.shop.rating_average.toFixed(1)}
                                <span className="mx-2">•</span>
                                {formatDate(reply.created_at)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-gray-900">
                                {formatCurrency(reply.total_price)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {reply.delivery_days} day delivery
                              </div>
                            </div>
                          </div>
                          
                          {reply.notes && (
                            <p className="text-gray-600 text-sm mb-3">{reply.notes}</p>
                          )}
                          
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-4">
                              <span className="text-gray-500">
                                <Truck className="w-4 h-4 inline mr-1" />
                                Delivery: {formatCurrency(reply.delivery_fee)}
                              </span>
                              {reply.valid_until && (
                                <span className="text-gray-500">
                                  <Clock className="w-4 h-4 inline mr-1" />
                                  Valid until: {formatDate(reply.valid_until)}
                                </span>
                              )}
                            </div>
                            
                            {currentUser.user_type === 'buyer' && reply.status === 'pending' && (
                              <div className="space-x-2">
                                <button className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                                  Accept
                                </button>
                                <button className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
                                  Negotiate
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      <MessageCircle className="w-5 h-5 inline mr-2" />
                      Messages
                    </h3>
                  </div>
                  
                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingMessages ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    ) : !messagesData?.length ? (
                      <div className="text-center py-8">
                        <MessageCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messagesData.map((message: RFQMessage) => (
                        <div
                          key={message.id}
                          className={`flex ${message?.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message?.sender_id === currentUser?.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-900'
                          }`}>
                            {!message?.sender_id === currentUser?.id && (
                              <div className="text-xs opacity-75 mb-1">
                                {message.sender.name}
                                {message.sender.shop_name && ` (${message.sender.shop_name})`}
                              </div>
                            )}
                            <div className="text-sm">{message.message}</div>
                            <div className={`text-xs mt-1 ${
                              message?.sender_id === currentUser?.id ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatDate(message.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200">
                    <form onSubmit={handleSendMessage} className="flex space-x-2">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={sendMessageMutation.isPending}
                      />
                      <button
                        type="button"
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <button
                        type="submit"
                        disabled={!messageText.trim() || sendMessageMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendMessageMutation.isPending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-600 font-medium">Failed to load RFQ details</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an RFQ</h3>
                <p className="text-gray-500">Choose an RFQ from the list to view details and manage communication.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_RFQInbox;