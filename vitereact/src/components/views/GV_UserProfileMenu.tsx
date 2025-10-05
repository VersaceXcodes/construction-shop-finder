import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { 
  User, 
  Settings, 
  ShoppingBag, 
  FileText, 
  Bell, 
  Search, 
  Store, 
  Package, 
  MessageSquare, 
  BarChart3, 
  LogOut, 
  HelpCircle, 
  Globe, 
  CheckCircle, 
  Shield 
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
  badge_count: number | null;
}

const GV_UserProfileMenu: React.FC = () => {
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Individual Zustand selectors to avoid infinite re-renders
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const bomItemCount = useAppStore(state => state.current_bom.item_count);
  const notificationState = useAppStore(state => state.notification_state);
  const language = useAppStore(state => state.app_preferences.language);
  const logoutUser = useAppStore(state => state.logout_user);
  const updateLanguage = useAppStore(state => state.update_language);

  // Handle outside click to close menu
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuExpanded(false);
      }
    };

    if (menuExpanded) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [menuExpanded]);

  // Generate menu items based on user type
  const generateMenuItems = (): MenuItem[] => {
    if (!currentUser) return [];

    const baseItems: MenuItem[] = [];

    if (currentUser.user_type === 'buyer') {
      baseItems.push(
        {
          id: 'profile',
          label: 'My Profile',
          route: '/profile',
          icon: <User size={18} />,
          badge_count: null
        },
        {
          id: 'boms',
          label: 'My BOMs',
          route: '/bom-library',
          icon: <FileText size={18} />,
          badge_count: bomItemCount > 0 ? bomItemCount : null
        },
        {
          id: 'saved-searches',
          label: 'Saved Searches',
          route: '/saved-searches',
          icon: <Search size={18} />,
          badge_count: null
        },
        {
          id: 'alerts',
          label: 'Price Alerts',
          route: '/alerts',
          icon: <Bell size={18} />,
          badge_count: notificationState.price_alerts > 0 ? notificationState.price_alerts : null
        },
        {
          id: 'orders',
          label: 'Order History',
          route: '/orders',
          icon: <ShoppingBag size={18} />,
          badge_count: null
        },
        {
          id: 'settings',
          label: 'Settings',
          route: '/settings',
          icon: <Settings size={18} />,
          badge_count: null
        }
      );
    } else if (currentUser.user_type === 'seller') {
      baseItems.push(
        {
          id: 'dashboard',
          label: 'Shop Dashboard',
          route: '/shop/dashboard',
          icon: <Store size={18} />,
          badge_count: null
        },
        {
          id: 'inventory',
          label: 'Inventory Management',
          route: '/shop/inventory',
          icon: <Package size={18} />,
          badge_count: null
        },
        {
          id: 'rfq',
          label: 'RFQ Inbox',
          route: '/rfq',
          icon: <MessageSquare size={18} />,
          badge_count: notificationState.rfq_messages > 0 ? notificationState.rfq_messages : null
        },
        {
          id: 'analytics',
          label: 'Analytics',
          route: '/shop/analytics',
          icon: <BarChart3 size={18} />,
          badge_count: null
        },
        {
          id: 'shop-settings',
          label: 'Shop Settings',
          route: '/shop/settings',
          icon: <Settings size={18} />,
          badge_count: null
        }
      );
    }

    return baseItems;
  };

  const handleToggleMenu = () => {
    setMenuExpanded(!menuExpanded);
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logoutUser();
      setMenuExpanded(false);
      // Navigation will be handled by the auth state change in App.tsx
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleLanguageToggle = async () => {
    const newLanguage = language === 'en' ? 'ar' : 'en';
    try {
      await updateLanguage(newLanguage);
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleMenuItemClick = () => {
    setMenuExpanded(false);
  };

  if (!currentUser || !authToken) {
    return null;
  }

  const menuItems = generateMenuItems();

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Avatar Button */}
        <button
          onClick={handleToggleMenu}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="User profile menu"
        >
          <div className="relative">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {currentUser.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle size={10} className="text-white" />
              </div>
            )}
            {notificationState.unread_count > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {notificationState.unread_count > 99 ? '99+' : notificationState.unread_count}
                </span>
              </div>
            )}
          </div>
          <div className="hidden md:block text-left">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">{currentUser.name}</span>
              {currentUser.user_type === 'seller' && (
                <Shield size={14} className="text-blue-600" />
              )}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {currentUser.user_type}
            </div>
          </div>
        </button>

        {/* Dropdown Menu */}
        {menuExpanded && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-lg">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  {currentUser.is_verified && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {currentUser.name}
                    </p>
                    {currentUser.user_type === 'seller' && (
                      <Shield size={14} className="text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {currentUser.user_type}
                    </span>
                    {currentUser.is_verified && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {menuItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  onClick={handleMenuItemClick}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge_count && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      {item.badge_count > 99 ? '99+' : item.badge_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Common Actions */}
            <div className="border-t border-gray-100 py-2">
              {/* Language Toggle */}
              <button
                onClick={handleLanguageToggle}
                className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                <Globe size={18} className="text-gray-400" />
                <span>Language: {language === 'en' ? 'English' : 'العربية'}</span>
              </button>

              {/* Help & Support */}
              <Link
                to="/help"
                onClick={handleMenuItemClick}
                className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                <HelpCircle size={18} className="text-gray-400" />
                <span>Help & Support</span>
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <LogOut size={18} className="text-red-500" />
                  <span>Logout</span>
                </div>
                {logoutLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_UserProfileMenu;