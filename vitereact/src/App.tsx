import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// Global shared views
import GV_TopNavigation from '@/components/views/GV_TopNavigation';
import GV_MobileBottomNav from '@/components/views/GV_MobileBottomNav';
import GV_BOMQuickAccess from '@/components/views/GV_BOMQuickAccess';

// Unique views
import UV_Landing from '@/components/views/UV_Landing';
import UV_UserRegistration from '@/components/views/UV_UserRegistration';
import UV_UserLogin from '@/components/views/UV_UserLogin';
import UV_SearchResults from '@/components/views/UV_SearchResults';
import UV_ProductDetails from '@/components/views/UV_ProductDetails';
import UV_ComparisonTable from '@/components/views/UV_ComparisonTable';
import UV_BOMBuilder from '@/components/views/UV_BOMBuilder';
import UV_ShopDashboard from '@/components/views/UV_ShopDashboard';
import UV_InventoryManager from '@/components/views/UV_InventoryManager';
import UV_RFQInbox from '@/components/views/UV_RFQInbox';
import UV_UserProfile from '@/components/views/UV_UserProfile';
import UV_MapView from '@/components/views/UV_MapView';
import UV_AlertManagement from '@/components/views/UV_AlertManagement';
import UV_CategoryBrowser from '@/components/views/UV_CategoryBrowser';
import UV_BarcodeScanner from '@/components/views/UV_BarcodeScanner';
import UV_TripPlanner from '@/components/views/UV_TripPlanner';
import UV_ShopSettings from '@/components/views/UV_ShopSettings';
import UV_OrderHistory from '@/components/views/UV_OrderHistory';
import UV_BOMLibrary from '@/components/views/UV_BOMLibrary';
import UV_SavedSearches from '@/components/views/UV_SavedSearches';
import UV_UserSettings from '@/components/views/UV_UserSettings';
import UV_ShopAnalytics from '@/components/views/UV_ShopAnalytics';
import UV_CommunityQA from '@/components/views/UV_CommunityQA';
import UV_HelpSupport from '@/components/views/UV_HelpSupport';
import UV_TermsConditions from '@/components/views/UV_TermsConditions';
import UV_PrivacyPolicy from '@/components/views/UV_PrivacyPolicy';
import UV_AboutUs from '@/components/views/UV_AboutUs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Loading component
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Layout component that handles shared views
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const language = useAppStore(state => state.app_preferences.language);
  
  // Views that should show GV_TopNavigation (based on sharedByViews in sitemap)
  const topNavViews = [
    '/', '/search', '/product', '/compare', '/bom', '/shop/dashboard', 
    '/shop/inventory', '/rfq', '/profile', '/map', '/alerts', '/categories',
    '/trip', '/shop/settings', '/orders', '/bom-library', '/saved-searches',
    '/settings', '/shop/analytics', '/community', '/help'
  ];
  
  // Views that should show GV_MobileBottomNav (based on sharedByViews in sitemap)
  const mobileBottomNavViews = [
    '/', '/search', '/product', '/compare', '/bom', '/shop/dashboard',
    '/shop/inventory', '/rfq', '/profile', '/map', '/alerts', '/categories',
    '/trip', '/orders', '/bom-library', '/community'
  ];
  
  // Views that should show GV_BOMQuickAccess (based on sharedByViews in sitemap)
  const bomQuickAccessViews = [
    '/search', '/product', '/compare', '/categories', '/map', '/scan'
  ];
  
  const showTopNav = topNavViews.some(path => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  });
  
  const showMobileBottomNav = mobileBottomNavViews.some(path => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  });
  
  const showBOMQuickAccess = isAuthenticated && bomQuickAccessViews.some(path => {
    return location.pathname.startsWith(path);
  });
  
  return (
    <div className={`min-h-screen bg-gray-50 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {showTopNav && <GV_TopNavigation />}
      
      <main className={`${showTopNav ? 'pt-16' : ''} ${showMobileBottomNav ? 'pb-16 md:pb-0' : ''}`}>
        {children}
      </main>
      
      {showMobileBottomNav && (
        <div className="md:hidden">
          <GV_MobileBottomNav />
        </div>
      )}
      
      {showBOMQuickAccess && <GV_BOMQuickAccess />}
    </div>
  );
};

const App: React.FC = () => {
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const initializeAuth = useAppStore(state => state.initialize_auth);
  
  useEffect(() => {
    // Initialize auth state when app loads
    initializeAuth();
  }, [initializeAuth]);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AppLayout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<UV_Landing />} />
            <Route path="/register" element={<UV_UserRegistration />} />
            <Route path="/login" element={<UV_UserLogin />} />
            <Route path="/categories/:category_path?" element={<UV_CategoryBrowser />} />
            <Route path="/help" element={<UV_HelpSupport />} />
            <Route path="/terms" element={<UV_TermsConditions />} />
            <Route path="/privacy" element={<UV_PrivacyPolicy />} />
            <Route path="/about" element={<UV_AboutUs />} />
            
            {/* Protected Routes */}
            <Route path="/search" element={
              <ProtectedRoute>
                <UV_SearchResults />
              </ProtectedRoute>
            } />
            <Route path="/product/:product_id" element={
              <ProtectedRoute>
                <UV_ProductDetails />
              </ProtectedRoute>
            } />
            <Route path="/compare" element={
              <ProtectedRoute>
                <UV_ComparisonTable />
              </ProtectedRoute>
            } />
            <Route path="/bom/:bom_id?" element={
              <ProtectedRoute>
                <UV_BOMBuilder />
              </ProtectedRoute>
            } />
            <Route path="/bom-library" element={
              <ProtectedRoute>
                <UV_BOMLibrary />
              </ProtectedRoute>
            } />
            <Route path="/shop/dashboard" element={
              <ProtectedRoute>
                <UV_ShopDashboard />
              </ProtectedRoute>
            } />
            <Route path="/shop/inventory" element={
              <ProtectedRoute>
                <UV_InventoryManager />
              </ProtectedRoute>
            } />
            <Route path="/shop/settings" element={
              <ProtectedRoute>
                <UV_ShopSettings />
              </ProtectedRoute>
            } />
            <Route path="/shop/analytics" element={
              <ProtectedRoute>
                <UV_ShopAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/rfq" element={
              <ProtectedRoute>
                <UV_RFQInbox />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <UV_UserProfile />
              </ProtectedRoute>
            } />
            <Route path="/map" element={
              <ProtectedRoute>
                <UV_MapView />
              </ProtectedRoute>
            } />
            <Route path="/alerts" element={
              <ProtectedRoute>
                <UV_AlertManagement />
              </ProtectedRoute>
            } />
            <Route path="/scan" element={
              <ProtectedRoute>
                <UV_BarcodeScanner />
              </ProtectedRoute>
            } />
            <Route path="/trip" element={
              <ProtectedRoute>
                <UV_TripPlanner />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <UV_OrderHistory />
              </ProtectedRoute>
            } />
            <Route path="/saved-searches" element={
              <ProtectedRoute>
                <UV_SavedSearches />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <UV_UserSettings />
              </ProtectedRoute>
            } />
            <Route path="/community" element={
              <ProtectedRoute>
                <UV_CommunityQA />
              </ProtectedRoute>
            } />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </QueryClientProvider>
    </Router>
  );
};

export default App;