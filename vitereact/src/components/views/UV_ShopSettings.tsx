import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types for shop data based on Zod schema
interface ShopData {
  id: string;
  user_id: string;
  name: string;
  phones: string[];
  location_lat: number;
  location_lng: number;
  address: string;
  hours: Record<string, any> | null;
  verified: boolean;
  business_license: string | null;
  shop_type: string | null;
  delivery_available: boolean;
  delivery_radius: number | null;
  delivery_fee_base: number | null;
  delivery_fee_per_km: number | null;
  minimum_order: number | null;
  cash_discount_percentage: number | null;
  rating_average: number;
  rating_count: number;
  response_time_hours: number | null;
  stock_accuracy_score: number;
  created_at: number;
  updated_at: number;
}

interface UpdateShopData {
  name?: string;
  phones?: string[];
  location_lat?: number;
  location_lng?: number;
  address?: string;
  hours?: Record<string, any> | null;
  business_license?: string | null;
  shop_type?: string | null;
  delivery_available?: boolean;
  delivery_radius?: number | null;
  delivery_fee_base?: number | null;
  delivery_fee_per_km?: number | null;
  minimum_order?: number | null;
  cash_discount_percentage?: number | null;
}

const UV_ShopSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'business';
  
  // Zustand store access
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // Local state for form data
  const [formData, setFormData] = useState<UpdateShopData>({});
  const [phoneInputs, setPhoneInputs] = useState<string[]>(['']);
  const [isModified, setIsModified] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const queryClient = useQueryClient();

  // Fetch shop data
  const { data: shopData, isLoading, error } = useQuery({
    queryKey: ['shop-settings', currentUser?.id],
    queryFn: async (): Promise<ShopData> => {
      if (!currentUser?.id || !authToken) {
        throw new Error('Authentication required');
      }

      // First, get user's shop
      const shopsResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops?user_id=${currentUser.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (!shopsResponse.data.shops || shopsResponse.data.shops.length === 0) {
        throw new Error('No shop found for this user');
      }

      const shop = shopsResponse.data.shops[0];
      
      // Get detailed shop data
      const shopResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/${shop.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      return shopResponse.data;
    },
    enabled: !!currentUser?.id && !!authToken,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Update shop mutation
  const updateShopMutation = useMutation({
    mutationFn: async (updates: UpdateShopData): Promise<ShopData> => {
      if (!shopData?.id || !authToken) {
        throw new Error('Shop ID and authentication required');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shops/${shopData.id}`,
        updates,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
      setIsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Failed to update shop:', error);
    }
  });

  // Initialize form data when shop data loads
  useEffect(() => {
    if (shopData) {
      setFormData({
        name: shopData.name,
        phones: shopData.phones,
        location_lat: shopData.location_lat,
        location_lng: shopData.location_lng,
        address: shopData.address,
        hours: shopData.hours,
        business_license: shopData.business_license,
        shop_type: shopData.shop_type,
        delivery_available: shopData.delivery_available,
        delivery_radius: shopData.delivery_radius,
        delivery_fee_base: shopData.delivery_fee_base,
        delivery_fee_per_km: shopData.delivery_fee_per_km,
        minimum_order: shopData.minimum_order,
        cash_discount_percentage: shopData.cash_discount_percentage,
      });
      setPhoneInputs(shopData.phones.length > 0 ? shopData.phones : ['']);
    }
  }, [shopData]);

  const handleSectionChange = (section: string) => {
    setSearchParams({ section });
  };

  const handleInputChange = (field: keyof UpdateShopData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsModified(true);
  };

  const handlePhoneChange = (index: number, value: string) => {
    const newPhones = [...phoneInputs];
    newPhones[index] = value;
    setPhoneInputs(newPhones);
    handleInputChange('phones', newPhones.filter(phone => phone.trim() !== ''));
  };

  const addPhoneInput = () => {
    setPhoneInputs([...phoneInputs, '']);
  };

  const removePhoneInput = (index: number) => {
    const newPhones = phoneInputs.filter((_, i) => i !== index);
    setPhoneInputs(newPhones);
    handleInputChange('phones', newPhones.filter(phone => phone.trim() !== ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateShopMutation.mutate(formData);
  };

  const sections = [
    { id: 'business', label: 'Business Info', icon: '🏪' },
    { id: 'contact', label: 'Contact & Location', icon: '📍' },
    { id: 'hours', label: 'Operating Hours', icon: '🕐' },
    { id: 'policies', label: 'Delivery & Policies', icon: '📋' },
    { id: 'integration', label: 'Integration', icon: '⚙️' },
    { id: 'marketing', label: 'Marketing', icon: '📈' },
  ];

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  if (error || !shopData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">❌</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Shop Not Found</h2>
              <p className="text-gray-600 mb-4">
                No shop is associated with your account. Please create a shop first.
              </p>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Create Shop
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Shop Settings</h1>
                  <p className="text-gray-600 mt-1">Manage your business configuration and platform integration</p>
                </div>
                {shopData.verified && (
                  <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeSection === section.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                <span>Settings saved successfully!</span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Business Information Section */}
            {activeSection === 'business' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Business Information</h2>
                  <p className="text-gray-600">Basic information about your business</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shop Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Enter your shop name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <select
                      value={formData.shop_type || ''}
                      onChange={(e) => handleInputChange('shop_type', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    >
                      <option value="">Select business type</option>
                      <option value="hardware_store">Hardware Store</option>
                      <option value="building_materials">Building Materials</option>
                      <option value="electrical_supplies">Electrical Supplies</option>
                      <option value="plumbing_supplies">Plumbing Supplies</option>
                      <option value="paint_supplies">Paint & Supplies</option>
                      <option value="tools_equipment">Tools & Equipment</option>
                      <option value="general_contractor">General Contractor</option>
                      <option value="specialty_supplier">Specialty Supplier</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business License Number
                    </label>
                    <input
                      type="text"
                      value={formData.business_license || ''}
                      onChange={(e) => handleInputChange('business_license', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Enter your business license number"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Required for verification and enhanced trust features
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact & Location Section */}
            {activeSection === 'contact' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Contact & Location</h2>
                  <p className="text-gray-600">Contact information and business location</p>
                </div>

                <div className="space-y-6">
                  {/* Phone Numbers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Numbers
                    </label>
                    <div className="space-y-3">
                      {phoneInputs.map((phone, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                            placeholder="+971 50 123 4567"
                          />
                          {phoneInputs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePhoneInput(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addPhoneInput}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                      >
                        + Add another phone number
                      </button>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address *
                    </label>
                    <textarea
                      value={formData.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Enter your complete business address"
                      required
                    />
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.location_lat || ''}
                        onChange={(e) => handleInputChange('location_lat', parseFloat(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        placeholder="25.2048"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.location_lng || ''}
                        onChange={(e) => handleInputChange('location_lng', parseFloat(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        placeholder="55.2708"
                        required
                      />
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    📍 Location coordinates help customers find your shop and calculate delivery distances
                  </p>
                </div>
              </div>
            )}

            {/* Operating Hours Section */}
            {activeSection === 'hours' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Operating Hours</h2>
                  <p className="text-gray-600">Set your business hours and availability</p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <div key={day} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {day}
                        </label>
                        <div className="space-y-2">
                          <input
                            type="time"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
                            placeholder="Open"
                          />
                          <input
                            type="time"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
                            placeholder="Close"
                          />
                          <label className="flex items-center text-sm text-gray-600">
                            <input type="checkbox" className="mr-2" />
                            Closed
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Special Hours & Holidays</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-700 text-sm">
                        💡 <strong>Coming Soon:</strong> Holiday schedules and special event hours will be available in the next update.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery & Policies Section */}
            {activeSection === 'policies' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Delivery & Policies</h2>
                  <p className="text-gray-600">Configure delivery options and business policies</p>
                </div>

                <div className="space-y-8">
                  {/* Delivery Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Options</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="delivery_available"
                          checked={formData.delivery_available || false}
                          onChange={(e) => handleInputChange('delivery_available', e.target.checked)}
                          className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="delivery_available" className="text-sm font-medium text-gray-700">
                          Offer delivery services
                        </label>
                      </div>

                      {formData.delivery_available && (
                        <div className="ml-8 space-y-4 border-l-4 border-blue-200 pl-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Delivery Radius (km)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={formData.delivery_radius || ''}
                                onChange={(e) => handleInputChange('delivery_radius', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                placeholder="25"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Base Delivery Fee (AED)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.delivery_fee_base || ''}
                                onChange={(e) => handleInputChange('delivery_fee_base', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                placeholder="50.00"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Per KM Fee (AED)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.delivery_fee_per_km || ''}
                                onChange={(e) => handleInputChange('delivery_fee_per_km', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                placeholder="5.00"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Policies */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Order Policies</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Minimum Order Amount (AED)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.minimum_order || ''}
                          onChange={(e) => handleInputChange('minimum_order', parseFloat(e.target.value))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="100.00"
                        />
                        <p className="text-sm text-gray-500 mt-1">Set 0 for no minimum order</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cash Discount (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.cash_discount_percentage || ''}
                          onChange={(e) => handleInputChange('cash_discount_percentage', parseFloat(e.target.value))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          placeholder="2.5"
                        />
                        <p className="text-sm text-gray-500 mt-1">Discount for cash payments</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Policies Info */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Policies</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Return Policy</h4>
                        <p className="text-blue-700 text-sm">
                          Configure return windows, conditions, and restocking fees. Coming in next update.
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2">Credit Terms</h4>
                        <p className="text-green-700 text-sm">
                          Set payment terms and credit limits for business customers. Coming in next update.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integration Section */}
            {activeSection === 'integration' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Platform Integration</h2>
                  <p className="text-gray-600">Connect your existing systems and automate operations</p>
                </div>

                <div className="space-y-8">
                  {/* Payment Methods */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['Cash', 'Credit Card', 'Bank Transfer', 'Mobile Payment'].map((method) => (
                        <div key={method} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
                          <input
                            type="checkbox"
                            id={method}
                            className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={method} className="text-sm font-medium text-gray-700">
                            {method}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* POS Integration */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">POS System Integration</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium text-gray-900">Inventory Synchronization</h4>
                          <p className="text-sm text-gray-600">Automatically sync stock levels and pricing</p>
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                          Connect POS
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        <p>📊 Supported systems: Square, Shopify POS, Toast POS, and custom API integrations</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Rules */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Automated Pricing</h3>
                    <div className="space-y-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-900 mb-2">🤖 Smart Pricing (Beta)</h4>
                        <p className="text-yellow-700 text-sm mb-3">
                          Automatically adjust prices based on competitor monitoring and market conditions
                        </p>
                        <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm">
                          Enable Smart Pricing
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Marketing Section */}
            {activeSection === 'marketing' && (
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Marketing & Promotions</h2>
                  <p className="text-gray-600">Optimize your shop visibility and customer engagement</p>
                </div>

                <div className="space-y-8">
                  {/* SEO Optimization */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">SEO & Visibility</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">📈 Search Ranking</h4>
                        <p className="text-blue-700 text-sm mb-3">
                          Current ranking: Top 15% in your category
                        </p>
                        <div className="bg-blue-100 rounded-full h-2 mb-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                        <p className="text-blue-600 text-xs">Optimization Score: 75/100</p>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2">🌟 Customer Rating</h4>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-2xl font-bold text-green-700">{shopData.rating_average.toFixed(1)}</span>
                          <div className="flex text-yellow-400">
                            {'★'.repeat(Math.floor(shopData.rating_average))}{'☆'.repeat(5 - Math.floor(shopData.rating_average))}
                          </div>
                        </div>
                        <p className="text-green-600 text-sm">{shopData.rating_count} reviews</p>
                      </div>
                    </div>
                  </div>

                  {/* Photo Management */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Photo Gallery</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📸</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">Upload Shop Photos</h4>
                      <p className="text-gray-600 text-sm mb-4">
                        Add photos of your shop, products, and team to build customer trust
                      </p>
                      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Upload Photos
                      </button>
                    </div>
                  </div>

                  {/* Promotions */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Promotions & Offers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">🎉 Special Offers</h4>
                        <p className="text-gray-600 text-sm mb-3">Create time-limited promotions and discounts</p>
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                          Create Promotion
                        </button>
                      </div>
                      
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">🏆 Loyalty Program</h4>
                        <p className="text-gray-600 text-sm mb-3">Reward repeat customers with points and discounts</p>
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                          Setup Loyalty
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Review Management */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Review Management</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium text-gray-900">Customer Feedback</h4>
                          <p className="text-sm text-gray-600">Monitor and respond to customer reviews</p>
                        </div>
                        <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                          View Reviews
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        <p>💡 Responding to reviews increases customer trust by 25% on average</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-4">
                {isModified && (
                  <div className="flex items-center text-orange-600">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                    <span className="text-sm font-medium">Unsaved changes</span>
                  </div>
                )}
                {updateShopMutation.error && (
                  <div className="text-red-600 text-sm">
                    ❌ Error saving changes: {updateShopMutation.error.message}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={updateShopMutation.isPending}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={!isModified || updateShopMutation.isPending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateShopMutation.isPending ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_ShopSettings;