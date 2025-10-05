import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  User, 
  Eye, 
  Bell, 
  Shield, 
  Accessibility, 
  Settings, 
  Save, 
  Download, 
  Trash2,
  Moon,
  Sun,
  Monitor,
  Globe,
  Smartphone,
  Mail,
  MessageSquare,
  Clock,
  DollarSign,
  MapPin,
  Calendar,
  Share2,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Types for settings
interface NotificationPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  price_alerts: boolean;
  stock_alerts: boolean;
  rfq_updates: boolean;
  quiet_hours: {
    start: string;
    end: string;
  };
}

interface PrivacySettings {
  profile_visibility: string;
  data_sharing_consent: boolean;
  analytics_consent: boolean;
  marketing_consent: boolean;
}

interface AppearanceSettings {
  theme: string;
  font_size: string;
  display_density: string;
  language: string;
  currency: string;
  units: string;
}

interface IntegrationSettings {
  calendar_sync: boolean;
  mapping_service: string;
  navigation_app: string;
  social_sharing: boolean;
}

interface AccessibilitySettings {
  high_contrast: boolean;
  screen_reader_support: boolean;
  keyboard_navigation: boolean;
  voice_commands: boolean;
  reduced_motion: boolean;
}

const UV_UserSettings: React.FC = () => {
  // Global state - use individual selectors to avoid infinite re-renders
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateUserProfile = useAppStore(state => state.update_user_profile);
  const updateLanguage = useAppStore(state => state.update_language);
  const updateCurrency = useAppStore(state => state.update_currency);
  const updateTheme = useAppStore(state => state.update_theme);

  // Local state
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    address: currentUser?.address || '',
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    price_alerts: true,
    stock_alerts: true,
    rfq_updates: true,
    quiet_hours: {
      start: '22:00',
      end: '08:00',
    },
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profile_visibility: 'private',
    data_sharing_consent: false,
    analytics_consent: true,
    marketing_consent: false,
  });

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: 'light',
    font_size: 'medium',
    display_density: 'comfortable',
    language: 'en',
    currency: 'AED',
    units: 'metric',
  });

  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({
    calendar_sync: false,
    mapping_service: 'google',
    navigation_app: 'default',
    social_sharing: false,
  });

  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    high_contrast: false,
    screen_reader_support: false,
    keyboard_navigation: false,
    voice_commands: false,
    reduced_motion: false,
  });

  const queryClient = useQueryClient();

  // Initialize form data from user preferences
  useEffect(() => {
    if (currentUser?.preferences) {
      const prefs = currentUser.preferences;
      
      if (prefs.notifications) {
        setNotificationPrefs(prev => ({ ...prev, ...prefs.notifications }));
      }
      if (prefs.privacy) {
        setPrivacySettings(prev => ({ ...prev, ...prefs.privacy }));
      }
      if (prefs.appearance) {
        setAppearanceSettings(prev => ({ ...prev, ...prefs.appearance }));
      }
      if (prefs.integrations) {
        setIntegrationSettings(prev => ({ ...prev, ...prefs.integrations }));
      }
      if (prefs.accessibility) {
        setAccessibilitySettings(prev => ({ ...prev, ...prefs.accessibility }));
      }
    }
  }, [currentUser]);

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: any) => {
      if (!currentUser || !authToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.id}`,
        { preferences },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (updatedUser) => {
      updateUserProfile(updatedUser);
      setLastSaved(new Date().toISOString());
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['user', currentUser?.id] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || 'Failed to save preferences');
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      if (!currentUser || !authToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.id}`,
        profileData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (updatedUser) => {
      updateUserProfile(updatedUser);
      setLastSaved(new Date().toISOString());
      setErrorMessage(null);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || 'Failed to update profile');
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  // Save functions
  const saveProfile = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    updateProfileMutation.mutate(profileData);
  };

  const saveNotifications = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const currentPrefs = currentUser?.preferences || {};
    updatePreferencesMutation.mutate({
      ...currentPrefs,
      notifications: notificationPrefs,
    });
  };

  const savePrivacy = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const currentPrefs = currentUser?.preferences || {};
    updatePreferencesMutation.mutate({
      ...currentPrefs,
      privacy: privacySettings,
    });
  };

  const saveAppearance = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    
    // Update global store for immediate effect
    updateTheme(appearanceSettings.theme);
    updateLanguage(appearanceSettings.language);
    updateCurrency(appearanceSettings.currency);
    
    const currentPrefs = currentUser?.preferences || {};
    updatePreferencesMutation.mutate({
      ...currentPrefs,
      appearance: appearanceSettings,
    });
  };

  const saveIntegrations = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const currentPrefs = currentUser?.preferences || {};
    updatePreferencesMutation.mutate({
      ...currentPrefs,
      integrations: integrationSettings,
    });
  };

  const saveAccessibility = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const currentPrefs = currentUser?.preferences || {};
    updatePreferencesMutation.mutate({
      ...currentPrefs,
      accessibility: accessibilitySettings,
    });
  };

  // Tab configuration
  const tabs = [
    { id: 'profile', label: 'Profile & Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Eye },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Data', icon: Shield },
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'integrations', label: 'Integrations', icon: Settings },
  ];

  if (!currentUser) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access your settings.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-lg text-gray-600">Customize your ConstructHub experience</p>
          </div>

          {/* Status Messages */}
          {errorMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {lastSaved && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <p className="text-green-700">
                  Settings saved successfully at {new Date(lastSaved).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Settings navigation">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Profile & Account Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile & Account</h2>
                    <p className="text-gray-600 mb-6">Manage your personal information and account details.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={currentUser.email}
                        disabled
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-500"
                        placeholder="Email cannot be changed"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div>
                      <label htmlFor="user_type" className="block text-sm font-medium text-gray-700 mb-2">
                        Account Type
                      </label>
                      <input
                        type="text"
                        id="user_type"
                        value={currentUser.user_type === 'buyer' ? 'Buyer Account' : 'Shop Owner Account'}
                        disabled
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea
                      id="address"
                      rows={3}
                      value={profileData.address}
                      onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      placeholder="Enter your address"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveProfile}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Appearance & Display</h2>
                    <p className="text-gray-600 mb-6">Customize how the platform looks and feels.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                      <div className="space-y-2">
                        {[
                          { value: 'light', label: 'Light', icon: Sun },
                          { value: 'dark', label: 'Dark', icon: Moon },
                          { value: 'system', label: 'System', icon: Monitor },
                        ].map((theme) => {
                          const Icon = theme.icon;
                          return (
                            <label key={theme.value} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name="theme"
                                value={theme.value}
                                checked={appearanceSettings.theme === theme.value}
                                onChange={(e) => setAppearanceSettings(prev => ({ ...prev, theme: e.target.value }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                              />
                              <Icon className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-700">{theme.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="font_size" className="block text-sm font-medium text-gray-700 mb-2">
                        Font Size
                      </label>
                      <select
                        id="font_size"
                        value={appearanceSettings.font_size}
                        onChange={(e) => setAppearanceSettings(prev => ({ ...prev, font_size: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="extra-large">Extra Large</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="display_density" className="block text-sm font-medium text-gray-700 mb-2">
                        Display Density
                      </label>
                      <select
                        id="display_density"
                        value={appearanceSettings.display_density}
                        onChange={(e) => setAppearanceSettings(prev => ({ ...prev, display_density: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select
                        id="language"
                        value={appearanceSettings.language}
                        onChange={(e) => setAppearanceSettings(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                        Currency
                      </label>
                      <select
                        id="currency"
                        value={appearanceSettings.currency}
                        onChange={(e) => setAppearanceSettings(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="AED">AED (درهم)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="SAR">SAR (ريال)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="units" className="block text-sm font-medium text-gray-700 mb-2">
                        Units System
                      </label>
                      <select
                        id="units"
                        value={appearanceSettings.units}
                        onChange={(e) => setAppearanceSettings(prev => ({ ...prev, units: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="metric">Metric (kg, m, L)</option>
                        <option value="imperial">Imperial (lb, ft, gal)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveAppearance}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Appearance'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
                    <p className="text-gray-600 mb-6">Control how and when you receive notifications.</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Methods</h3>
                      <div className="space-y-4">
                        {[
                          { key: 'email_notifications', label: 'Email Notifications', icon: Mail },
                          { key: 'sms_notifications', label: 'SMS Notifications', icon: Smartphone },
                          { key: 'push_notifications', label: 'Push Notifications', icon: Bell },
                        ].map((method) => {
                          const Icon = method.icon;
                          return (
                            <div key={method.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Icon className="h-5 w-5 text-gray-500" />
                                <span className="font-medium text-gray-900">{method.label}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={notificationPrefs[method.key as keyof NotificationPreferences] as boolean}
                                  onChange={(e) => setNotificationPrefs(prev => ({ 
                                    ...prev, 
                                    [method.key]: e.target.checked 
                                  }))}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
                      <div className="space-y-4">
                        {[
                          { key: 'price_alerts', label: 'Price Drop Alerts', icon: DollarSign },
                          { key: 'stock_alerts', label: 'Stock Availability Alerts', icon: Bell },
                          { key: 'rfq_updates', label: 'RFQ Updates', icon: MessageSquare },
                        ].map((type) => {
                          const Icon = type.icon;
                          return (
                            <div key={type.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Icon className="h-5 w-5 text-gray-500" />
                                <span className="font-medium text-gray-900">{type.label}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={notificationPrefs[type.key as keyof NotificationPreferences] as boolean}
                                  onChange={(e) => setNotificationPrefs(prev => ({ 
                                    ...prev, 
                                    [type.key]: e.target.checked 
                                  }))}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Quiet Hours</h3>
                      <div className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                        <Clock className="h-5 w-5 text-gray-500" />
                        <span className="text-gray-700">Do not send notifications between:</span>
                        <input
                          type="time"
                          value={notificationPrefs.quiet_hours.start}
                          onChange={(e) => setNotificationPrefs(prev => ({
                            ...prev,
                            quiet_hours: { ...prev.quiet_hours, start: e.target.value }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-gray-500">and</span>
                        <input
                          type="time"
                          value={notificationPrefs.quiet_hours.end}
                          onChange={(e) => setNotificationPrefs(prev => ({
                            ...prev,
                            quiet_hours: { ...prev.quiet_hours, end: e.target.value }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveNotifications}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Notifications'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy & Data</h2>
                    <p className="text-gray-600 mb-6">Control your data privacy and sharing preferences.</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Visibility</h3>
                      <select
                        value={privacySettings.profile_visibility}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, profile_visibility: e.target.value }))}
                        className="w-full max-w-md px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="private">Private - Only visible to you</option>
                        <option value="contacts">Contacts - Visible to your connections</option>
                        <option value="public">Public - Visible to everyone</option>
                      </select>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Data Sharing & Consent</h3>
                      <div className="space-y-4">
                        {[
                          { 
                            key: 'data_sharing_consent', 
                            label: 'Share data with partner shops',
                            description: 'Allow shops to see your purchase history for better recommendations'
                          },
                          { 
                            key: 'analytics_consent', 
                            label: 'Analytics and performance',
                            description: 'Help us improve the platform by sharing usage analytics'
                          },
                          { 
                            key: 'marketing_consent', 
                            label: 'Marketing communications',
                            description: 'Receive promotional emails and special offers'
                          },
                        ].map((setting) => (
                          <div key={setting.key} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">{setting.label}</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={privacySettings[setting.key as keyof PrivacySettings] as boolean}
                                  onChange={(e) => setPrivacySettings(prev => ({ 
                                    ...prev, 
                                    [setting.key]: e.target.checked 
                                  }))}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>
                            <p className="text-sm text-gray-600">{setting.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
                      <div className="space-y-4">
                        <button className="flex items-center space-x-3 w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <Download className="h-5 w-5 text-blue-600" />
                          <div className="flex-1 text-left">
                            <span className="font-medium text-gray-900">Export My Data</span>
                            <p className="text-sm text-gray-600">Download a copy of all your data (GDPR compliant)</p>
                          </div>
                        </button>
                        
                        <button className="flex items-center space-x-3 w-full p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600">
                          <Trash2 className="h-5 w-5" />
                          <div className="flex-1 text-left">
                            <span className="font-medium">Delete My Account</span>
                            <p className="text-sm">Permanently delete your account and all associated data</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={savePrivacy}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Privacy Settings'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Accessibility Tab */}
              {activeTab === 'accessibility' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Accessibility Features</h2>
                    <p className="text-gray-600 mb-6">Configure accessibility options to improve your experience.</p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { 
                        key: 'high_contrast', 
                        label: 'High Contrast Mode',
                        description: 'Increase color contrast for better visibility'
                      },
                      { 
                        key: 'screen_reader_support', 
                        label: 'Screen Reader Support',
                        description: 'Optimize interface for screen reading software'
                      },
                      { 
                        key: 'keyboard_navigation', 
                        label: 'Enhanced Keyboard Navigation',
                        description: 'Improve keyboard-only navigation experience'
                      },
                      { 
                        key: 'voice_commands', 
                        label: 'Voice Commands',
                        description: 'Enable voice control for common actions'
                      },
                      { 
                        key: 'reduced_motion', 
                        label: 'Reduced Motion',
                        description: 'Minimize animations and transitions'
                      },
                    ].map((feature) => (
                      <div key={feature.key} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{feature.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={accessibilitySettings[feature.key as keyof AccessibilitySettings]}
                              onChange={(e) => setAccessibilitySettings(prev => ({ 
                                ...prev, 
                                [feature.key]: e.target.checked 
                              }))}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveAccessibility}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Accessibility'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">External Integrations</h2>
                    <p className="text-gray-600 mb-6">Connect with external services and apps.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-gray-500" />
                          <span className="font-medium text-gray-900">Calendar Sync</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={integrationSettings.calendar_sync}
                            onChange={(e) => setIntegrationSettings(prev => ({ 
                              ...prev, 
                              calendar_sync: e.target.checked 
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <p className="text-sm text-gray-600">Sync project deadlines and shopping trips with your calendar</p>
                    </div>

                    <div>
                      <label htmlFor="mapping_service" className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="inline h-4 w-4 mr-2" />
                        Preferred Mapping Service
                      </label>
                      <select
                        id="mapping_service"
                        value={integrationSettings.mapping_service}
                        onChange={(e) => setIntegrationSettings(prev => ({ ...prev, mapping_service: e.target.value }))}
                        className="w-full max-w-md px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="google">Google Maps</option>
                        <option value="apple">Apple Maps</option>
                        <option value="waze">Waze</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="navigation_app" className="block text-sm font-medium text-gray-700 mb-2">
                        Navigation App
                      </label>
                      <select
                        id="navigation_app"
                        value={integrationSettings.navigation_app}
                        onChange={(e) => setIntegrationSettings(prev => ({ ...prev, navigation_app: e.target.value }))}
                        className="w-full max-w-md px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                      >
                        <option value="default">Default System App</option>
                        <option value="google">Google Maps</option>
                        <option value="waze">Waze</option>
                        <option value="apple">Apple Maps</option>
                      </select>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Share2 className="h-5 w-5 text-gray-500" />
                          <span className="font-medium text-gray-900">Social Sharing</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={integrationSettings.social_sharing}
                            onChange={(e) => setIntegrationSettings(prev => ({ 
                              ...prev, 
                              social_sharing: e.target.checked 
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <p className="text-sm text-gray-600">Enable sharing of BOMs and project updates on social media</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveIntegrations}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Integrations'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_UserSettings;