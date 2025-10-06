import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAppStore } from '@/store/main';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://123construction-shop-finder.launchpulse.ai',
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from store
    const store = useAppStore.getState();
    const token = store.authentication_state.auth_token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add timestamp to prevent caching issues
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    const config = error.config;
    const response = error.response;
    
    console.error(`❌ ${error.code} ${config?.method?.toUpperCase()} ${config?.url}`, {
      status: response?.status,
      statusText: response?.statusText,
      data: response?.data,
      message: error.message
    });

    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - server may be overloaded');
    } else if (error.code === 'NETWORK_ERROR' || !response) {
      console.error('Network error - server may be unreachable');
    } else if (response?.status === 401) {
      // Token expired or invalid
      const store = useAppStore.getState();
      store.logout_user();
      window.location.href = '/login';
    } else if (response?.status >= 500) {
      console.error('Server error - please try again later');
    }

    // Enhance error message for better debugging
    const enhancedError = {
      ...error,
      message: error.response?.data?.message || error.message || 'Network request failed',
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: config?.url,
      method: config?.method?.toUpperCase()
    };

    return Promise.reject(enhancedError);
  }
);

export default api;

// Export commonly used methods
export const get = api.get;
export const post = api.post;
export const put = api.put;
export const patch = api.patch;
export const del = api.delete;