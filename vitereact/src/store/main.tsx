import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// ================================
// TypeScript Interfaces
// ================================

interface User {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  user_type: 'buyer' | 'seller';
  location_lat: number | null;
  location_lng: number | null;
  address: string | null;
  preferences: Record<string, any> | null;
  is_verified: boolean;
  last_login: number | null;
  created_at: number;
  updated_at: number;
}

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

interface ComparisonItem {
  variant_id: string;
  shop_id: string;
  price: number;
  in_stock: boolean;
  distance_km?: number;
}

interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

interface CurrentBOMState {
  id: string | null;
  title: string | null;
  items: BOMItem[];
  total_cost: number;
  item_count: number;
  last_updated: string | null;
}

interface ActiveComparisonState {
  product_ids: string[];
  shop_ids: string[];
  quantity: number;
  comparison_data: ComparisonItem[];
}

interface UserLocationState {
  coordinates: { lat: number; lng: number } | null;
  address: string | null;
  accuracy: number | null;
}

interface AppPreferencesState {
  language: string;
  currency: string;
  units: string;
  theme: string;
  offline_mode: boolean;
}

interface NotificationState {
  unread_count: number;
  price_alerts: number;
  rfq_messages: number;
  system_notifications: number;
}

interface WebSocketState {
  socket: Socket | null;
  is_connected: boolean;
  connection_error: string | null;
  reconnect_attempts: number;
}

// ================================
// Main Store Interface
// ================================

interface AppStore {
  // Global State
  authentication_state: AuthenticationState;
  current_bom: CurrentBOMState;
  active_comparison: ActiveComparisonState;
  user_location: UserLocationState;
  app_preferences: AppPreferencesState;
  notification_state: NotificationState;
  websocket_state: WebSocketState;

  // Authentication Actions
  login_user: (email: string, password: string) => Promise<void>;
  register_user: (userData: {
    email: string;
    password: string;
    name: string;
    user_type: 'buyer' | 'seller';
    phone?: string;
    location_lat?: number;
    location_lng?: number;
    address?: string;
  }) => Promise<void>;
  logout_user: () => Promise<void>;
  initialize_auth: () => Promise<void>;
  clear_auth_error: () => void;
  update_user_profile: (userData: Partial<User>) => void;

  // BOM Management Actions
  create_bom: (bomData: {
    title: string;
    description?: string;
    project_type?: string;
    template?: string;
    is_public?: boolean;
  }) => Promise<void>;
  load_bom: (bom_id: string) => Promise<void>;
  update_bom: (bomData: Partial<BOM>) => Promise<void>;
  add_bom_item: (itemData: {
    variant_id: string;
    quantity: number;
    unit: string;
    waste_factor?: number;
    notes?: string;
  }) => Promise<void>;
  remove_bom_item: (item_id: string) => Promise<void>;
  clear_current_bom: () => void;

  // Comparison Actions
  add_to_comparison: (variant_id: string) => void;
  remove_from_comparison: (variant_id: string) => void;
  clear_comparison: () => void;
  update_comparison_quantity: (quantity: number) => void;

  // Location Actions
  update_user_location: (location: {
    coordinates: { lat: number; lng: number };
    address?: string;
    accuracy?: number;
  }) => void;
  clear_user_location: () => void;

  // Preferences Actions
  update_language: (language: string) => Promise<void>;
  update_currency: (currency: string) => Promise<void>;
  update_theme: (theme: string) => void;
  toggle_offline_mode: () => void;

  // Notification Actions
  update_notification_counts: (counts: Partial<NotificationState>) => void;
  mark_notifications_read: (type?: string) => void;

  // Real-time Actions
  connect_websocket: () => void;
  disconnect_websocket: () => void;
  handle_price_alert: (alertData: any) => void;
  handle_stock_update: (stockData: any) => void;
  handle_rfq_message: (messageData: any) => void;
  handle_rfq_status_change: (statusData: any) => void;
}

// ================================
// Store Implementation
// ================================

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ================================
      // Initial State
      // ================================
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: true,
        },
        error_message: null,
      },

      current_bom: {
        id: null,
        title: null,
        items: [],
        total_cost: 0,
        item_count: 0,
        last_updated: null,
      },

      active_comparison: {
        product_ids: [],
        shop_ids: [],
        quantity: 1,
        comparison_data: [],
      },

      user_location: {
        coordinates: null,
        address: null,
        accuracy: null,
      },

      app_preferences: {
        language: 'en',
        currency: 'AED',
        units: 'metric',
        theme: 'light',
        offline_mode: false,
      },

      notification_state: {
        unread_count: 0,
        price_alerts: 0,
        rfq_messages: 0,
        system_notifications: 0,
      },

      websocket_state: {
        socket: null,
        is_connected: false,
        connection_error: null,
        reconnect_attempts: 0,
      },

      // ================================
      // Authentication Actions
      // ================================
      login_user: async (email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token } = response.data;

          set((state) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after successful login
          get().connect_websocket();
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Login failed';
          
          set((state) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      register_user: async (userData) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/register`,
            {
              email: userData.email,
              password: userData.password,
              name: userData.name,
              user_type: userData.user_type,
              phone: userData.phone || null,
              location_lat: userData.location_lat || null,
              location_lng: userData.location_lng || null,
              address: userData.address || null,
            },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token } = response.data;

          set((state) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after successful registration
          get().connect_websocket();
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
          
          set((state) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      logout_user: async () => {
        const { auth_token } = get().authentication_state;
        
        try {
          if (auth_token) {
            await axios.post(
              `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/logout`,
              {},
              { headers: { Authorization: `Bearer ${auth_token}` } }
            );
          }
        } catch (error) {
          console.warn('Logout API call failed:', error);
        }

        // Disconnect WebSocket
        get().disconnect_websocket();

        // Clear all state
        set((state) => ({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: {
              is_authenticated: false,
              is_loading: false,
            },
            error_message: null,
          },
          current_bom: {
            id: null,
            title: null,
            items: [],
            total_cost: 0,
            item_count: 0,
            last_updated: null,
          },
          active_comparison: {
            product_ids: [],
            shop_ids: [],
            quantity: 1,
            comparison_data: [],
          },
          notification_state: {
            unread_count: 0,
            price_alerts: 0,
            rfq_messages: 0,
            system_notifications: 0,
          },
        }));
      },

      initialize_auth: async () => {
        const { authentication_state } = get();
        const token = authentication_state.auth_token;
        
        if (!token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
            },
          }));
          return;
        }

        try {
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const user = response.data;
          
          set((state) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after successful token verification
          get().connect_websocket();
        } catch (error) {
          // Token is invalid, clear auth state
          set((state) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: null,
            },
          }));
        }
      },

      clear_auth_error: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            error_message: null,
          },
        }));
      },

      update_user_profile: (userData: Partial<User>) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: state.authentication_state.current_user 
              ? { ...state.authentication_state.current_user, ...userData }
              : null,
          },
        }));
      },

      // ================================
      // BOM Management Actions
      // ================================
      create_bom: async (bomData) => {
        const { auth_token } = get().authentication_state;
        
        if (!auth_token) {
          throw new Error('Authentication required');
        }

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms`,
            bomData,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const bom = response.data;

          set((state) => ({
            current_bom: {
              id: bom.id,
              title: bom.title,
              items: [],
              total_cost: bom.total_cost,
              item_count: bom.item_count,
              last_updated: new Date(bom.updated_at).toISOString(),
            },
          }));
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to create BOM');
        }
      },

      load_bom: async (bom_id: string) => {
        const { auth_token } = get().authentication_state;
        
        if (!auth_token) {
          throw new Error('Authentication required');
        }

        try {
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${bom_id}`,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const bom = response.data;

          set((state) => ({
            current_bom: {
              id: bom.id,
              title: bom.title,
              items: bom.items || [],
              total_cost: bom.total_cost,
              item_count: bom.item_count,
              last_updated: new Date(bom.updated_at).toISOString(),
            },
          }));
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to load BOM');
        }
      },

      update_bom: async (bomData: Partial<BOM>) => {
        const { auth_token } = get().authentication_state;
        const { current_bom } = get();
        
        if (!auth_token || !current_bom.id) {
          throw new Error('Authentication and active BOM required');
        }

        try {
          const response = await axios.put(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${current_bom.id}`,
            bomData,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const updatedBom = response.data;

          set((state) => ({
            current_bom: {
              ...state.current_bom,
              title: updatedBom.title,
              total_cost: updatedBom.total_cost,
              item_count: updatedBom.item_count,
              last_updated: new Date(updatedBom.updated_at).toISOString(),
            },
          }));
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to update BOM');
        }
      },

      add_bom_item: async (itemData) => {
        const { auth_token } = get().authentication_state;
        const { current_bom } = get();
        
        if (!auth_token || !current_bom.id) {
          throw new Error('Authentication and active BOM required');
        }

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${current_bom.id}/items`,
            {
              variant_id: itemData.variant_id,
              quantity: itemData.quantity,
              unit: itemData.unit,
              waste_factor: itemData.waste_factor || 0,
              notes: itemData.notes || null,
            },
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          const newItem = response.data;

          set((state) => ({
            current_bom: {
              ...state.current_bom,
              items: [...state.current_bom.items, newItem],
              item_count: state.current_bom.item_count + 1,
              last_updated: new Date().toISOString(),
            },
          }));
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to add item to BOM');
        }
      },

      remove_bom_item: async (item_id: string) => {
        const { auth_token } = get().authentication_state;
        const { current_bom } = get();
        
        if (!auth_token || !current_bom.id) {
          throw new Error('Authentication and active BOM required');
        }

        try {
          await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${current_bom.id}/items/${item_id}`,
            { headers: { Authorization: `Bearer ${auth_token}` } }
          );

          set((state) => ({
            current_bom: {
              ...state.current_bom,
              items: state.current_bom.items.filter(item => item.id !== item_id),
              item_count: Math.max(0, state.current_bom.item_count - 1),
              last_updated: new Date().toISOString(),
            },
          }));
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to remove item from BOM');
        }
      },

      clear_current_bom: () => {
        set((state) => ({
          current_bom: {
            id: null,
            title: null,
            items: [],
            total_cost: 0,
            item_count: 0,
            last_updated: null,
          },
        }));
      },

      // ================================
      // Comparison Actions
      // ================================
      add_to_comparison: (variant_id: string) => {
        set((state) => ({
          active_comparison: {
            ...state.active_comparison,
            product_ids: state.active_comparison.product_ids.includes(variant_id)
              ? state.active_comparison.product_ids
              : [...state.active_comparison.product_ids, variant_id],
          },
        }));
      },

      remove_from_comparison: (variant_id: string) => {
        set((state) => ({
          active_comparison: {
            ...state.active_comparison,
            product_ids: state.active_comparison.product_ids.filter(id => id !== variant_id),
            comparison_data: state.active_comparison.comparison_data.filter(item => item.variant_id !== variant_id),
          },
        }));
      },

      clear_comparison: () => {
        set((state) => ({
          active_comparison: {
            product_ids: [],
            shop_ids: [],
            quantity: 1,
            comparison_data: [],
          },
        }));
      },

      update_comparison_quantity: (quantity: number) => {
        set((state) => ({
          active_comparison: {
            ...state.active_comparison,
            quantity: Math.max(1, quantity),
          },
        }));
      },

      // ================================
      // Location Actions
      // ================================
      update_user_location: (location) => {
        set((state) => ({
          user_location: {
            coordinates: location.coordinates,
            address: location.address || null,
            accuracy: location.accuracy || null,
          },
        }));
      },

      clear_user_location: () => {
        set((state) => ({
          user_location: {
            coordinates: null,
            address: null,
            accuracy: null,
          },
        }));
      },

      // ================================
      // Preferences Actions
      // ================================
      update_language: async (language: string) => {
        const { auth_token, current_user } = get().authentication_state;
        
        set((state) => ({
          app_preferences: {
            ...state.app_preferences,
            language,
          },
        }));

        // Update user preferences on server if authenticated
        if (auth_token && current_user) {
          try {
            await axios.put(
              `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${current_user.id}`,
              {
                preferences: {
                  ...current_user.preferences,
                  language,
                },
              },
              { headers: { Authorization: `Bearer ${auth_token}` } }
            );
          } catch (error) {
            console.warn('Failed to update language preference on server:', error);
          }
        }
      },

      update_currency: async (currency: string) => {
        const { auth_token, current_user } = get().authentication_state;
        
        set((state) => ({
          app_preferences: {
            ...state.app_preferences,
            currency,
          },
        }));

        // Update user preferences on server if authenticated
        if (auth_token && current_user) {
          try {
            await axios.put(
              `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${current_user.id}`,
              {
                preferences: {
                  ...current_user.preferences,
                  currency,
                },
              },
              { headers: { Authorization: `Bearer ${auth_token}` } }
            );
          } catch (error) {
            console.warn('Failed to update currency preference on server:', error);
          }
        }
      },

      update_theme: (theme: string) => {
        set((state) => ({
          app_preferences: {
            ...state.app_preferences,
            theme,
          },
        }));
      },

      toggle_offline_mode: () => {
        set((state) => ({
          app_preferences: {
            ...state.app_preferences,
            offline_mode: !state.app_preferences.offline_mode,
          },
        }));
      },

      // ================================
      // Notification Actions
      // ================================
      update_notification_counts: (counts: Partial<NotificationState>) => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            ...counts,
          },
        }));
      },

      mark_notifications_read: (type?: string) => {
        set((state) => {
          if (type) {
            return {
              notification_state: {
                ...state.notification_state,
                [type]: 0,
                unread_count: Math.max(0, state.notification_state.unread_count - state.notification_state[type as keyof NotificationState] as number),
              },
            };
          } else {
            return {
              notification_state: {
                unread_count: 0,
                price_alerts: 0,
                rfq_messages: 0,
                system_notifications: 0,
              },
            };
          }
        });
      },

      // ================================
      // WebSocket Real-time Actions
      // ================================
      connect_websocket: () => {
        const { websocket_state, authentication_state } = get();
        
        if (websocket_state.socket && websocket_state.is_connected) {
          return; // Already connected
        }

        try {
          const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', {
            auth: {
              token: authentication_state.auth_token,
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });

          socket.on('connect', () => {
            set((state) => ({
              websocket_state: {
                ...state.websocket_state,
                socket,
                is_connected: true,
                connection_error: null,
                reconnect_attempts: 0,
              },
            }));
          });

          socket.on('disconnect', () => {
            set((state) => ({
              websocket_state: {
                ...state.websocket_state,
                is_connected: false,
              },
            }));
          });

          socket.on('connect_error', (error) => {
            set((state) => ({
              websocket_state: {
                ...state.websocket_state,
                connection_error: error.message,
                reconnect_attempts: state.websocket_state.reconnect_attempts + 1,
              },
            }));
          });

          // Real-time event handlers
          socket.on('price_alert_triggered', (data) => {
            get().handle_price_alert(data);
          });

          socket.on('stock_status_changed', (data) => {
            get().handle_stock_update(data);
          });

          socket.on('message_sent', (data) => {
            get().handle_rfq_message(data);
          });

          socket.on('rfq_status_changed', (data) => {
            get().handle_rfq_status_change(data);
          });

          set((state) => ({
            websocket_state: {
              ...state.websocket_state,
              socket,
            },
          }));
        } catch (error: any) {
          set((state) => ({
            websocket_state: {
              ...state.websocket_state,
              connection_error: error.message,
            },
          }));
        }
      },

      disconnect_websocket: () => {
        const { websocket_state } = get();
        
        if (websocket_state.socket) {
          websocket_state.socket.disconnect();
        }

        set((state) => ({
          websocket_state: {
            socket: null,
            is_connected: false,
            connection_error: null,
            reconnect_attempts: 0,
          },
        }));
      },

      handle_price_alert: (alertData: any) => {
        // Update notification count for price alerts
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            price_alerts: state.notification_state.price_alerts + 1,
            unread_count: state.notification_state.unread_count + 1,
          },
        }));
      },

      handle_stock_update: (stockData: any) => {
        // Handle stock status changes - could trigger notifications or update comparison data
        console.log('Stock update received:', stockData);
      },

      handle_rfq_message: (messageData: any) => {
        // Update notification count for RFQ messages
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            rfq_messages: state.notification_state.rfq_messages + 1,
            unread_count: state.notification_state.unread_count + 1,
          },
        }));
      },

      handle_rfq_status_change: (statusData: any) => {
        // Handle RFQ status changes
        console.log('RFQ status changed:', statusData);
      },
    }),
    {
      name: 'constructhub-app-storage',
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false, // Never persist loading state
          },
          error_message: null, // Never persist errors
        },
        current_bom: state.current_bom,
        active_comparison: state.active_comparison,
        user_location: state.user_location,
        app_preferences: state.app_preferences,
        notification_state: state.notification_state,
        // Don't persist websocket_state
      }),
    }
  )
);

// ================================
// Export Types for Components
// ================================
export type { 
  User, 
  BOM, 
  BOMItem, 
  ComparisonItem, 
  AuthenticationState, 
  CurrentBOMState,
  ActiveComparisonState,
  UserLocationState,
  AppPreferencesState,
  NotificationState,
  WebSocketState,
  AppStore 
};