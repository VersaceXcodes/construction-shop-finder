import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  MagnifyingGlassIcon, 
  FolderIcon, 
  PlusIcon, 
  TrashIcon, 
  PlayIcon,
  BellIcon,
  ChartBarIcon,
  TagIcon,
  ClockIcon,
  StarIcon,
  ShareIcon,
  Cog6ToothIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

// Type definitions
interface SavedSearch {
  id: string;
  query: string;
  filters: {
    category?: string;
    brand?: string;
    location_lat?: number;
    location_lng?: number;
    price_min?: number;
    price_max?: number;
    radius?: number;
  };
  results_count: number;
  created_at: number;
  name?: string;
  folder?: string;
  tags?: string[];
  is_favorite?: boolean;
  alert_enabled?: boolean;
  last_executed?: number;
  performance_data?: {
    avg_results: number;
    price_trend: 'up' | 'down' | 'stable';
    new_products_count: number;
  };
}

interface SearchFolder {
  id: string;
  name: string;
  search_count: number;
  color: string;
}

const UV_SavedSearches: React.FC = () => {
  // Zustand state - individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  // const language = useAppStore(state => state.app_preferences.language);

  // Local state
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSearches, setSelectedSearches] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'results' | 'performance'>('recent');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const queryClient = useQueryClient();

  // API functions
  const fetchSearchHistory = async (): Promise<SavedSearch[]> => {
    if (!authToken) throw new Error('Authentication required');
    
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/search/history`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { limit: 100, offset: 0 }
      }
    );
    
    // Transform search history to SavedSearch format with mock additional data
    return response.data.searches.map((search: any, index: number) => ({
      id: `search_${index}`,
      query: search.query,
      filters: search.filters || {},
      results_count: search.results_count || 0,
      created_at: search.created_at,
      name: `Search: ${search.query}`,
      folder: index % 3 === 0 ? 'Project Alpha' : index % 3 === 1 ? 'Market Research' : undefined,
      tags: search.query.includes('cement') ? ['construction', 'materials'] : ['general'],
      is_favorite: index % 5 === 0,
      alert_enabled: index % 4 === 0,
      last_executed: search.created_at,
      performance_data: {
        avg_results: Math.floor(Math.random() * 50) + 10,
        price_trend: ['up', 'down', 'stable'][index % 3] as 'up' | 'down' | 'stable',
        new_products_count: Math.floor(Math.random() * 5)
      }
    }));
  };

  const executeSearch = async (searchData: SavedSearch) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', searchData.query);
    
    if (searchData.filters.category) searchParams.set('category', searchData.filters.category);
    if (searchData.filters.brand) searchParams.set('brand', searchData.filters.brand);
    if (searchData.filters.price_min) searchParams.set('price_min', searchData.filters.price_min.toString());
    if (searchData.filters.price_max) searchParams.set('price_max', searchData.filters.price_max.toString());
    
    return `/search?${searchParams.toString()}`;
  };

  const createAlert = async (searchId: string) => {
    if (!authToken) throw new Error('Authentication required');
    
    await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/alerts`,
      {
        type: 'new_product',
        condition_type: 'equals',
        notification_methods: ['push', 'email']
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  // Queries
  const { data: savedSearches = [], isLoading, error } = useQuery({
    queryKey: ['saved-searches', currentUser?.id],
    queryFn: fetchSearchHistory,
    enabled: !!authToken && !!currentUser,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Mutations
  const executeSearchMutation = useMutation({
    mutationFn: executeSearch
  });

  const createAlertMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  // Computed data
  const folders: SearchFolder[] = useMemo(() => {
    const folderMap = new Map<string, number>();
    savedSearches.forEach(search => {
      if (search.folder) {
        folderMap.set(search.folder, (folderMap.get(search.folder) || 0) + 1);
      }
    });
    
    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800'];
    
    return Array.from(folderMap.entries()).map(([name, count], index) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      search_count: count,
      color: colors[index % colors.length]
    }));
  }, [savedSearches]);

  const filteredSearches = useMemo(() => {
    let filtered = savedSearches;

    // Filter by folder
    if (selectedFolder !== 'all') {
      const folderName = folders.find(f => f.id === selectedFolder)?.name;
      filtered = filtered.filter(search => search.folder === folderName);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(search => 
        search.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
        search.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        search.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.name || a.query).localeCompare(b.name || b.query));
        break;
      case 'results':
        filtered.sort((a, b) => b.results_count - a.results_count);
        break;
      case 'performance':
        filtered.sort((a, b) => (b.performance_data?.avg_results || 0) - (a.performance_data?.avg_results || 0));
        break;
      default:
        filtered.sort((a, b) => b.created_at - a.created_at);
    }

    return filtered;
  }, [savedSearches, selectedFolder, searchTerm, sortBy, folders]);

  const handleExecuteSearch = (search: SavedSearch) => {
    const url = executeSearch(search);
    window.location.href = url;
  };

  const handleCreateAlert = (searchId: string) => {
    createAlertMutation.mutate(searchId);
  };

  const handleToggleSelection = (searchId: string) => {
    setSelectedSearches(prev => 
      prev.includes(searchId) 
        ? prev.filter(id => id !== searchId)
        : [...prev, searchId]
    );
  };

  const handleSelectAll = () => {
    setSelectedSearches(
      selectedSearches.length === filteredSearches.length ? [] : filteredSearches.map(s => s.id)
    );
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading saved searches...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load searches</h3>
            <p className="text-gray-600">Please try again later.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Saved Searches</h1>
                  <p className="mt-2 text-gray-600">
                    Manage and optimize your product discovery activities
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Link
                    to="/search"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Search
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="w-full lg:w-80 space-y-6">
              {/* Search and Filter */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="space-y-4">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search saved searches..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </button>
                    </div>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    >
                      <option value="recent">Recent</option>
                      <option value="name">Name</option>
                      <option value="results">Results</option>
                      <option value="performance">Performance</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Folders */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Folders</h3>
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFolder('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFolder === 'all' 
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FolderIcon className="h-4 w-4 mr-2" />
                        All Searches
                      </div>
                      <span className="text-sm text-gray-500">{savedSearches.length}</span>
                    </div>
                  </button>

                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedFolder === folder.id 
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FolderIcon className="h-4 w-4 mr-2" />
                          {folder.name}
                        </div>
                        <span className="text-sm text-gray-500">{folder.search_count}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {showCreateFolder && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            setShowCreateFolder(false);
                            setNewFolderName('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName('');
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Searches</span>
                    <span className="font-semibold">{savedSearches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">With Alerts</span>
                    <span className="font-semibold">{savedSearches.filter(s => s.alert_enabled).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Favorites</span>
                    <span className="font-semibold">{savedSearches.filter(s => s.is_favorite).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Results</span>
                    <span className="font-semibold">
                      {Math.round(savedSearches.reduce((sum, s) => sum + s.results_count, 0) / savedSearches.length) || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {/* Bulk Actions */}
              {selectedSearches.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-blue-700 font-medium">
                        {selectedSearches.length} search{selectedSearches.length !== 1 ? 'es' : ''} selected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {/* Bulk create alerts */}}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <BellIcon className="h-4 w-4 inline mr-1" />
                        Create Alerts
                      </button>
                      <button
                        onClick={() => setSelectedSearches([])}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {filteredSearches.length === 0 ? (
                <div className="text-center py-12">
                  <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No saved searches found</h3>
                  <p className="text-gray-600 mb-4">Start saving your searches to track market trends and get alerts.</p>
                  <Link
                    to="/search"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create First Search
                  </Link>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                  {filteredSearches.map((search) => (
                    <div
                      key={search.id}
                      className={`bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 ${
                        viewMode === 'list' ? 'p-6' : 'p-4'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedSearches.includes(search.id)}
                            onChange={() => handleToggleSelection(search.id)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {search.name || search.query}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              "{search.query}"
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {search.is_favorite && (
                            <StarIconSolid className="h-4 w-4 text-yellow-400" />
                          )}
                          {search.alert_enabled && (
                            <BellIcon className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      </div>

                      {/* Search Metadata */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {search.folder && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <FolderIcon className="h-3 w-3 mr-1" />
                            {search.folder}
                          </span>
                        )}
                        {search.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            <TagIcon className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Performance Indicators */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900">{search.results_count}</div>
                          <div className="text-xs text-gray-500">Results</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-lg font-semibold text-gray-900">
                              {search.performance_data?.avg_results || 0}
                            </span>
                            <span className={`ml-1 text-xs ${
                              search.performance_data?.price_trend === 'up' ? 'text-red-500' :
                              search.performance_data?.price_trend === 'down' ? 'text-green-500' :
                              'text-gray-500'
                            }`}>
                              {search.performance_data?.price_trend === 'up' ? '↗' :
                               search.performance_data?.price_trend === 'down' ? '↙' : '→'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">Avg Results</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900">
                            {search.performance_data?.new_products_count || 0}
                          </div>
                          <div className="text-xs text-gray-500">New</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleExecuteSearch(search)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <PlayIcon className="h-3 w-3 mr-1" />
                            Execute
                          </button>
                          {!search.alert_enabled && (
                            <button
                              onClick={() => handleCreateAlert(search.id)}
                              disabled={createAlertMutation.isPending}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              <BellIcon className="h-3 w-3 mr-1" />
                              Alert
                            </button>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">
                            {new Date(search.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination would go here if needed */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SavedSearches;