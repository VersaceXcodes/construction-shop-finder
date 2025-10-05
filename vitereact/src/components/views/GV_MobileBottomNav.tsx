import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Scale, Folder, MessageCircle, User, Store } from 'lucide-react';
import { useAppStore } from '@/store/main';

const GV_MobileBottomNav: React.FC = () => {
  const location = useLocation();
  
  // Access global state with individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const bomItemCount = useAppStore(state => state.current_bom.item_count);
  const comparisonCount = useAppStore(state => state.active_comparison.product_ids.length);
  const unreadMessageCount = useAppStore(state => state.notification_state.rfq_messages);
  
  const userType = currentUser?.user_type || 'guest';
  
  // Determine active tab based on current route
  const getActiveTab = (): string => {
    const path = location.pathname;
    
    if (path === '/' || path.startsWith('/search') || path.startsWith('/categories')) {
      return 'search';
    }
    if (path.startsWith('/compare')) {
      return 'compare';
    }
    if (path.startsWith('/bom') || path.startsWith('/shop/dashboard') || path.startsWith('/shop/inventory')) {
      return 'bom';
    }
    if (path.startsWith('/rfq')) {
      return 'messages';
    }
    if (path.startsWith('/profile') || path.startsWith('/shop/settings')) {
      return 'profile';
    }
    
    return 'search';
  };

  const activeTab = getActiveTab();

  // Navigation configurations based on user type
  const getNavItems = () => {
    const baseItems = [
      {
        id: 'search',
        label: 'Search',
        icon: Search,
        route: isAuthenticated ? '/search' : '/',
        badge: null,
        disabled: false,
        guestPrompt: false,
      },
    ];

    if (userType === 'seller') {
      // Shop owner navigation
      return [
        ...baseItems,
        {
          id: 'messages',
          label: 'RFQs',
          icon: MessageCircle,
          route: '/rfq',
          badge: unreadMessageCount > 0 ? unreadMessageCount : null,
          disabled: !isAuthenticated,
          guestPrompt: !isAuthenticated,
        },
        {
          id: 'bom',
          label: 'Shop',
          icon: Store,
          route: '/shop/dashboard',
          badge: null,
          disabled: !isAuthenticated,
          guestPrompt: !isAuthenticated,
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: User,
          route: isAuthenticated ? '/profile' : '/login',
          badge: null,
          disabled: false,
          guestPrompt: false,
        },
      ];
    } else {
      // Buyer navigation (including guest)
      return [
        ...baseItems,
        {
          id: 'compare',
          label: 'Compare',
          icon: Scale,
          route: '/compare',
          badge: comparisonCount > 0 ? comparisonCount : null,
          disabled: !isAuthenticated,
          guestPrompt: !isAuthenticated,
        },
        {
          id: 'bom',
          label: 'Projects',
          icon: Folder,
          route: '/bom',
          badge: bomItemCount > 0 ? bomItemCount : null,
          disabled: !isAuthenticated,
          guestPrompt: !isAuthenticated,
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: MessageCircle,
          route: '/rfq',
          badge: unreadMessageCount > 0 ? unreadMessageCount : null,
          disabled: !isAuthenticated,
          guestPrompt: !isAuthenticated,
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: User,
          route: isAuthenticated ? '/profile' : '/login',
          badge: null,
          disabled: false,
          guestPrompt: false,
        },
      ];
    }
  };

  const navItems = getNavItems();

  // Badge component
  const Badge: React.FC<{ count: number }> = ({ count }) => (
    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium min-w-[20px]">
      {count > 99 ? '99+' : count}
    </div>
  );

  // Guest prompt modal could be triggered here
  const handleGuestClick = (e: React.MouseEvent, disabled: boolean, guestPrompt: boolean) => {
    if (disabled && guestPrompt) {
      e.preventDefault();
      // Could trigger a modal or redirect to registration
      // For now, redirect to login
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.disabled;
            
            const tabContent = (
              <>
                <div className="relative">
                  <IconComponent 
                    size={24} 
                    className={`${
                      isActive 
                        ? 'text-blue-600' 
                        : isDisabled 
                          ? 'text-gray-300' 
                          : 'text-gray-500'
                    } transition-colors duration-200`}
                  />
                  {item.badge && (
                    <Badge count={item.badge} />
                  )}
                </div>
                <span 
                  className={`text-xs mt-1 font-medium ${
                    isActive 
                      ? 'text-blue-600' 
                      : isDisabled 
                        ? 'text-gray-300' 
                        : 'text-gray-500'
                  } transition-colors duration-200`}
                >
                  {item.label}
                </span>
              </>
            );

            return (
              <div key={item.id} className="relative">
                {isDisabled ? (
                  <button
                    onClick={(e) => handleGuestClick(e, isDisabled, item.guestPrompt)}
                    className={`w-full h-full flex flex-col items-center justify-center space-y-1 transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-50' 
                        : 'hover:bg-gray-50 active:bg-gray-100'
                    }`}
                    disabled={isDisabled && !item.guestPrompt}
                  >
                    {tabContent}
                  </button>
                ) : (
                  <Link
                    to={item.route}
                    className={`w-full h-full flex flex-col items-center justify-center space-y-1 transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-50' 
                        : 'hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    {tabContent}
                  </Link>
                )}
                
                {/* Active tab indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full"></div>
                )}
                
                {/* Guest prompt indicator */}
                {isDisabled && item.guestPrompt && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full"></div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Safe area padding for devices with home indicator */}
        <div className="h-safe-area-inset-bottom bg-white"></div>
      </div>
      
      {/* Guest user upgrade prompt banner */}
      {!isAuthenticated && (
        <div className="fixed bottom-16 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 md:hidden z-40">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">
                Sign up to access all features
              </p>
              <p className="text-xs text-blue-100">
                Create BOMs, compare prices, and manage projects
              </p>
            </div>
            <Link
              to="/register"
              className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors duration-200 ml-3"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_MobileBottomNav;