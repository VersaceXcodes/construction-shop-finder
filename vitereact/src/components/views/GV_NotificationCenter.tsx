import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  BellIcon, 
  XMarkIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { 
  BellIcon as BellSolidIcon,
  ExclamationTriangleIcon as ExclamationTriangleSolidIcon 
} from '@heroicons/react/24/solid';

// TypeScript Interfaces
interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read_at: number | null;
  action_url: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: number;
}

interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total: number;
}

interface MarkReadResponse {
  marked_count: number;
}

// Notification API Functions
const fetchNotifications = async (token: string, type?: string): Promise<NotificationsResponse> => {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  if (type && type !== 'all') {
    params.append('type', type);
  }

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

const markNotificationRead = async (token: string, notificationId: string): Promise<void> => {
  await axios.put(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications/${notificationId}/read`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
};

const markAllNotificationsRead = async (token: string): Promise<MarkReadResponse> => {
  const response = await axios.put(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications/mark-all-read`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

// Helper Functions
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const formatAbsoluteTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

const getNotificationIcon = (type: string, priority: string) => {
  const iconClass = `h-5 w-5 ${priority === 'urgent' ? 'text-red-500' : priority === 'high' ? 'text-orange-500' : 'text-blue-500'}`;
  
  if (type.includes('alert') || type.includes('price') || type.includes('stock')) {
    return priority === 'urgent' ? 
      <ExclamationTriangleSolidIcon className={iconClass} /> :
      <ExclamationTriangleIcon className={iconClass} />;
  }
  if (type.includes('message') || type.includes('rfq')) {
    return <ChatBubbleLeftRightIcon className={iconClass} />;
  }
  if (type.includes('system')) {
    return <CogIcon className={iconClass} />;
  }
  if (type.includes('community') || type.includes('review') || type.includes('qa')) {
    return <UsersIcon className={iconClass} />;
  }
  return <BellIcon className={iconClass} />;
};

const categorizeNotification = (type: string): string => {
  if (type.includes('alert') || type.includes('price') || type.includes('stock')) return 'alerts';
  if (type.includes('message') || type.includes('rfq')) return 'messages';
  if (type.includes('system')) return 'system';
  if (type.includes('community') || type.includes('review') || type.includes('qa')) return 'community';
  return 'all';
};

interface GV_NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const GV_NotificationCenter: React.FC<GV_NotificationCenterProps> = ({ isOpen, onClose }) => {
  // Zustand store state (individual selectors to prevent infinite loops)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const updateNotificationCounts = useAppStore(state => state.update_notification_counts);

  // Local state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // React Query
  const queryClient = useQueryClient();

  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    error: notificationsError,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['notifications', activeFilter],
    queryFn: () => fetchNotifications(authToken!, activeFilter),
    enabled: !!authToken && isAuthenticated && isOpen,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 1
  });

  const markReadMutation = useMutation({
    mutationFn: ({ notificationId }: { notificationId: string }) => 
      markNotificationRead(authToken!, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(authToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      updateNotificationCounts({ unread_count: 0 });
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Failed to mark all notifications as read:', error);
    }
  });

  // Filter notifications by category
  const filteredNotifications = useMemo(() => {
    if (!notificationsData?.notifications) return [];
    
    if (activeFilter === 'all') {
      return notificationsData.notifications;
    }
    
    return notificationsData.notifications.filter(notification => 
      categorizeNotification(notification.type) === activeFilter
    );
  }, [notificationsData?.notifications, activeFilter]);

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!notificationsData?.notifications) return {};
    
    const counts = {
      all: notificationsData.notifications.length,
      alerts: 0,
      messages: 0,
      system: 0,
      community: 0
    };
    
    notificationsData.notifications.forEach(notification => {
      const category = categorizeNotification(notification.type);
      if (category !== 'all') {
        counts[category as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [notificationsData?.notifications]);

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markReadMutation.mutate({ notificationId: notification.id });
    }
    
    if (notification.action_url) {
      onClose();
      // Navigate to the action URL - this will be handled by React Router
      window.location.href = notification.action_url;
    }
  };

  // Handle bulk operations
  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    }
  };

  const handleMarkSelectedRead = () => {
    const unreadSelected = selectedNotifications.filter(id => {
      const notification = filteredNotifications.find(n => n.id === id);
      return notification && !notification.read_at;
    });
    
    unreadSelected.forEach(id => {
      markReadMutation.mutate({ notificationId: id });
    });
    
    setSelectedNotifications([]);
  };

  // Update global notification counts
  useEffect(() => {
    if (notificationsData) {
      updateNotificationCounts({
        unread_count: notificationsData.unread_count
      });
    }
  }, [notificationsData, updateNotificationCounts]);

  // Don't render if not authenticated
  if (!isAuthenticated || !isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Notification Panel */}
      <div className="fixed top-16 right-4 w-96 max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[calc(100vh-5rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <BellSolidIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {(notificationsData?.unread_count ?? 0) > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {notificationsData?.unread_count ?? 0}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Toggle expanded view"
            >
              {isExpanded ? 
                <ChevronUpIcon className="h-4 w-4" /> : 
                <ChevronDownIcon className="h-4 w-4" />
              }
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close notifications"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-2" aria-label="Notification filters">
            {[
              { key: 'all', label: 'All', count: (categoryCounts as any).all ?? 0 },
              { key: 'alerts', label: 'Alerts', count: (categoryCounts as any).alerts ?? 0 },
              { key: 'messages', label: 'Messages', count: (categoryCounts as any).messages ?? 0 },
              { key: 'system', label: 'System', count: (categoryCounts as any).system ?? 0 },
              { key: 'community', label: 'Community', count: (categoryCounts as any).community ?? 0 }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => {
                  setActiveFilter(filter.key);
                  setSelectedNotifications([]);
                }}
                className={`flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{filter.label}</span>
                {filter.count > 0 && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    activeFilter === filter.key
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Bulk Actions */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span>
                {selectedNotifications.length > 0 
                  ? `${selectedNotifications.length} selected`
                  : 'Select all'
                }
              </span>
            </label>
            <div className="flex items-center space-x-2">
              {selectedNotifications.length > 0 && (
                <button
                  onClick={handleMarkSelectedRead}
                  disabled={markReadMutation.isPending}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                >
                  Mark Read
                </button>
              )}
              {(notificationsData?.unread_count ?? 0) > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                >
                  {markAllReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className={`flex-1 overflow-y-auto ${isExpanded ? 'max-h-96' : 'max-h-80'}`}>
          {isLoadingNotifications ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notificationsError ? (
            <div className="p-4 text-center">
              <p className="text-sm text-red-600 mb-2">Failed to load notifications</p>
              <button
                onClick={() => refetchNotifications()}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Try Again
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BellIcon className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-2">No notifications</p>
              <p className="text-xs text-gray-400">
                {activeFilter === 'all' 
                  ? "You're all caught up!"
                  : `No ${activeFilter} notifications`
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer relative ${
                    !notification.read_at ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedNotifications([...selectedNotifications, notification.id]);
                          } else {
                            setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium truncate ${
                          !notification.read_at ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.read_at && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2"></div>
                        )}
                      </div>
                      
                      <p className={`text-sm mt-1 line-clamp-2 ${
                        !notification.read_at ? 'text-gray-700' : 'text-gray-500'
                      }`}>
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div 
                          className="flex items-center space-x-2 text-xs text-gray-400"
                          title={formatAbsoluteTime(notification.created_at)}
                        >
                          <ClockIcon className="h-3 w-3" />
                          <span>{formatRelativeTime(notification.created_at)}</span>
                        </div>
                        
                        {notification.priority === 'urgent' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Urgent
                          </span>
                        )}
                        {notification.priority === 'high' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            High
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {notification.action_url && (
                    <div className="mt-2 ml-9">
                      <Link
                        to={notification.action_url}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <Link
              to="/alerts"
              onClick={onClose}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage All Notifications →
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_NotificationCenter;