import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { User, Camera, MapPin, Bell, Shield, Settings, Save, Edit3, X, Check, Upload } from 'lucide-react';

// Types for API responses and requests
interface UpdateUserProfileRequest {
  name?: string;
  phone?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  address?: string | null;
  preferences?: Record<string, any> | null;
}

interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

const UV_UserProfile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Zustand store selectors - individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateUserProfile = useAppStore(state => state.update_user_profile);
  const language = useAppStore(state => state.app_preferences.language);
  const currency = useAppStore(state => state.app_preferences.currency);
  const updateLanguage = useAppStore(state => state.update_language);
  const updateCurrency = useAppStore(state => state.update_currency);

  // Local state
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'personal');
  const [editMode, setEditMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateUserProfileRequest>({});
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [locationPickerActive, setLocationPickerActive] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  // Update URL when tab changes
  useEffect(() => {
    const newTab = searchParams.get('tab') || 'personal';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams, activeTab]);

  // Load user profile data
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/me`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfileRequest) => {
      if (!currentUser?.id) throw new Error('User ID required');
      
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.id}`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      updateUserProfile(data);
      queryClient.setQueryData(['userProfile'], data);
      setEditMode(null);
      setFormData({});
    },
  });

  // Change password mutation (using the noted missing endpoint pattern)
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      // Note: This endpoint is marked as missing in the architecture spec
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/change-password`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setEditMode(null);
    },
  });

  // Profile image upload mutation (using the noted missing endpoint pattern)
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentUser?.id) throw new Error('User ID required');
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      // Note: This endpoint is marked as missing in the architecture spec
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.id}/avatar`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      updateUserProfile(data);
      setProfileImageFile(null);
      setProfileImagePreview(null);
    },
  });

  // Handler functions
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setEditMode(null);
  };

  const handleEditToggle = (section: string) => {
    if (editMode === section) {
      setEditMode(null);
      setFormData({});
    } else {
      setEditMode(section);
      if (section === 'personal' && userData) {
        setFormData({
          name: userData.name,
          phone: userData.phone,
          address: userData.address,
        });
      }
    }
  };

  const handleFormDataChange = (field: keyof UpdateUserProfileRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    if (Object.keys(formData).length > 0) {
      updateProfileMutation.mutate(formData);
    }
  };

  const handlePasswordChange = () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      return; // Add error handling
    }
    changePasswordMutation.mutate({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setProfileImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = () => {
    if (profileImageFile) {
      uploadImageMutation.mutate(profileImageFile);
    }
  };

  const handleLocationUpdate = (lat: number, lng: number, address: string) => {
    handleFormDataChange('location_lat', lat);
    handleFormDataChange('location_lng', lng);
    handleFormDataChange('address', address);
    setLocationPickerActive(false);
  };

  const user = userData || currentUser;

  if (userLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
            <div className="px-6 py-8">
              <div className="flex items-center space-x-6">
                {/* Profile Image */}
                <div className="relative">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : user?.name ? (
                      <span className="text-2xl font-bold text-gray-600">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900">{user?.name}</h1>
                  <p className="text-gray-600 mt-1">{user?.email}</p>
                  <div className="flex items-center mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user?.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user?.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="ml-3 text-sm text-gray-500 capitalize">{user?.user_type}</span>
                  </div>
                </div>

                {/* Upload Button */}
                {profileImageFile && (
                  <button
                    onClick={handleImageUpload}
                    disabled={uploadImageMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {uploadImageMutation.isPending ? 'Uploading...' : 'Save Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex">
                {[
                  { id: 'personal', label: 'Personal Info', icon: User },
                  { id: 'preferences', label: 'Preferences', icon: Settings },
                  { id: 'security', label: 'Security', icon: Shield },
                  ...(user?.user_type === 'buyer' ? [{ id: 'business', label: 'Business', icon: Bell }] : []),
                ].map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <IconComponent className="w-5 h-5 mr-2" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* Personal Information Tab */}
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                    <button
                      onClick={() => handleEditToggle('personal')}
                      className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {editMode === 'personal' ? <X className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
                      {editMode === 'personal' ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      {editMode === 'personal' ? (
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => handleFormDataChange('name', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{user?.name}</p>
                      )}
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500">{user?.email} (Cannot be changed)</p>
                    </div>

                    {/* Phone Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      {editMode === 'personal' ? (
                        <input
                          type="tel"
                          value={formData.phone || ''}
                          onChange={(e) => handleFormDataChange('phone', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter phone number"
                        />
                      ) : (
                        <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{user?.phone || 'Not provided'}</p>
                      )}
                    </div>

                    {/* Location Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      {editMode === 'personal' ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={formData.address || ''}
                            onChange={(e) => handleFormDataChange('address', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter address"
                          />
                          <button
                            onClick={() => setLocationPickerActive(!locationPickerActive)}
                            className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            {locationPickerActive ? 'Hide Map' : 'Select on Map'}
                          </button>
                        </div>
                      ) : (
                        <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{user?.address || 'Not provided'}</p>
                      )}
                    </div>
                  </div>

                  {/* Location Picker */}
                  {locationPickerActive && editMode === 'personal' && (
                    <div className="bg-gray-100 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Map integration would go here</p>
                      <button
                        onClick={() => handleLocationUpdate(25.2048, 55.2708, 'Dubai Marina, Dubai, UAE')}
                        className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Use Sample Location
                      </button>
                    </div>
                  )}

                  {/* Save Button */}
                  {editMode === 'personal' && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Account Preferences</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Language Preference */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                      <select
                        value={language}
                        onChange={(e) => updateLanguage(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="ar">العربية (Arabic)</option>
                      </select>
                    </div>

                    {/* Currency Preference */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => updateCurrency(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="AED">AED (UAE Dirham)</option>
                        <option value="USD">USD (US Dollar)</option>
                        <option value="EUR">EUR (Euro)</option>
                        <option value="SAR">SAR (Saudi Riyal)</option>
                      </select>
                    </div>
                  </div>

                  {/* Communication Preferences */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Communication Preferences</h3>
                    <div className="space-y-3">
                      {[
                        { id: 'email_alerts', label: 'Email Alerts', description: 'Receive price and stock alerts via email' },
                        { id: 'sms_notifications', label: 'SMS Notifications', description: 'Receive important updates via SMS' },
                        { id: 'push_notifications', label: 'Push Notifications', description: 'Receive real-time notifications in browser' },
                        { id: 'marketing_emails', label: 'Marketing Emails', description: 'Receive promotional offers and updates' },
                      ].map((pref) => (
                        <div key={pref.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                          <div>
                            <p className="font-medium text-gray-900">{pref.label}</p>
                            <p className="text-sm text-gray-500">{pref.description}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>

                  {/* Change Password */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                      <button
                        onClick={() => handleEditToggle('password')}
                        className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {editMode === 'password' ? <X className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
                        {editMode === 'password' ? 'Cancel' : 'Change Password'}
                      </button>
                    </div>

                    {editMode === 'password' && (
                      <div className="space-y-4">
                        <input
                          type="password"
                          placeholder="Current Password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="password"
                          placeholder="New Password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="password"
                          placeholder="Confirm New Password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={handlePasswordChange}
                          disabled={changePasswordMutation.isPending || passwordData.new_password !== passwordData.confirm_password}
                          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Login History */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Last login: {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</p>
                      <p className="text-sm text-gray-600 mt-1">Account created: {user?.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Business Tab (for buyers only) */}
              {activeTab === 'business' && user?.user_type === 'buyer' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Business Features</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quick Links */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">Quick Access</h3>
                      <div className="space-y-2">
                        <Link to="/alerts" className="block text-blue-600 hover:text-blue-700 text-sm">
                          Manage Price Alerts
                        </Link>
                        <Link to="/saved-searches" className="block text-blue-600 hover:text-blue-700 text-sm">
                          Saved Searches
                        </Link>
                        <Link to="/bom-library" className="block text-blue-600 hover:text-blue-700 text-sm">
                          BOM Library
                        </Link>
                        <Link to="/orders" className="block text-blue-600 hover:text-blue-700 text-sm">
                          Order History
                        </Link>
                      </div>
                    </div>

                    {/* Account Stats */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">Account Statistics</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">Active BOMs: 3</p>
                        <p className="text-sm text-gray-600">Price Alerts: 12</p>
                        <p className="text-sm text-gray-600">Saved Searches: 8</p>
                        <p className="text-sm text-gray-600">Orders Placed: 23</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {(updateProfileMutation.error || changePasswordMutation.error || uploadImageMutation.error) && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm">
                {updateProfileMutation.error?.message || 
                 changePasswordMutation.error?.message || 
                 uploadImageMutation.error?.message}
              </p>
            </div>
          )}

          {/* Success Display */}
          {(updateProfileMutation.isSuccess || changePasswordMutation.isSuccess || uploadImageMutation.isSuccess) && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="text-sm flex items-center">
                <Check className="w-4 h-4 mr-2" />
                {updateProfileMutation.isSuccess && 'Profile updated successfully!'}
                {changePasswordMutation.isSuccess && 'Password changed successfully!'}
                {uploadImageMutation.isSuccess && 'Profile image updated successfully!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_UserProfile;