import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  Squares2X2Icon,
  ListBulletIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  BuildingOffice2Icon,
  TagIcon,
  PencilIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

// Types
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
}

interface BOMTemplate {
  id: string;
  name: string;
  description: string;
  project_type: string;
  estimated_items: number;
  estimated_cost: number;
  thumbnail?: string;
}

interface FilterState {
  search: string;
  project_type: string;
  status: string;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

const UV_BOMLibrary: React.FC = () => {
  // Zustand store access
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.app_preferences.currency);
  const language = useAppStore(state => state.app_preferences.language);
  const loadBom = useAppStore(state => state.load_bom);
  // const createBom = useAppStore(state => state.create_bom);

  // Local state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    project_type: '',
    status: '',
    sort_by: 'updated_at',
    sort_order: 'desc'
  });

  const queryClient = useQueryClient();

  // Fetch user's BOMs
  const { data: bomsData, isLoading: bomsLoading, error: bomsError } = useQuery({
    queryKey: ['user-boms', filters],
    queryFn: async () => {
      if (!authToken) throw new Error('No auth token');
      
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        ...(filters.search && { query: filters.search }),
        ...(filters.project_type && { project_type: filters.project_type }),
        ...(filters.status && { status: filters.status })
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    select: (data) => ({
      boms: data.boms || [],
      total: Number(data.total || 0)
    })
  });

  // Fetch BOM templates
  const { data: templatesData } = useQuery({
    queryKey: ['bom-templates'],
    queryFn: async () => {
      // Mock templates data since API doesn't exist yet
      return {
        templates: [
          {
            id: 'residential_foundation',
            name: 'Residential Foundation',
            description: 'Complete material list for residential foundation construction',
            project_type: 'residential',
            estimated_items: 15,
            estimated_cost: 25000
          },
          {
            id: 'commercial_framing',
            name: 'Commercial Framing',
            description: 'Steel and concrete framing for commercial buildings',
            project_type: 'commercial',
            estimated_items: 32,
            estimated_cost: 85000
          },
          {
            id: 'villa_finishing',
            name: 'Villa Finishing Works',
            description: 'Complete finishing materials for luxury villa',
            project_type: 'residential',
            estimated_items: 45,
            estimated_cost: 120000
          },
          {
            id: 'warehouse_construction',
            name: 'Warehouse Construction',
            description: 'Industrial warehouse construction materials',
            project_type: 'industrial',
            estimated_items: 28,
            estimated_cost: 65000
          }
        ]
      };
    },
    staleTime: 300000
  });

  // Create BOM mutation
  const createBomMutation = useMutation({
    mutationFn: async (bomData: { title: string; description?: string; project_type?: string; template?: string }) => {
      if (!authToken) throw new Error('No auth token');
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms`,
        bomData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: (newBom) => {
      queryClient.invalidateQueries({ queryKey: ['user-boms'] });
      setShowCreateModal(false);
      loadBom(newBom.id);
    }
  });

  // Duplicate BOM mutation
  const duplicateBomMutation = useMutation({
    mutationFn: async ({ bomId, title }: { bomId: string; title: string }) => {
      if (!authToken) throw new Error('No auth token');
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${bomId}/duplicate`,
        { title },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-boms'] });
    }
  });

  // Delete BOM mutation
  const deleteBomMutation = useMutation({
    mutationFn: async (bomId: string) => {
      if (!authToken) throw new Error('No auth token');
      
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${bomId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-boms'] });
    }
  });

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-AE' : 'en-AE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-4 w-4" />;
      case 'active': return <ClockIcon className="h-4 w-4" />;
      case 'draft': return <PencilIcon className="h-4 w-4" />;
      case 'archived': return <ExclamationTriangleIcon className="h-4 w-4" />;
      default: return <TagIcon className="h-4 w-4" />;
    }
  };

  const handleCreateBom = async (data: { title: string; description?: string; project_type?: string; template?: string }) => {
    try {
      await createBomMutation.mutateAsync(data);
    } catch (error) {
      console.error('Failed to create BOM:', error);
    }
  };

  const handleDuplicateBom = async (bomId: string, originalTitle: string) => {
    const title = `${originalTitle} (Copy)`;
    try {
      await duplicateBomMutation.mutateAsync({ bomId, title });
    } catch (error) {
      console.error('Failed to duplicate BOM:', error);
    }
  };

  const handleDeleteBom = async (bomId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await deleteBomMutation.mutateAsync(bomId);
      } catch (error) {
        console.error('Failed to delete BOM:', error);
      }
    }
  };



  const boms = bomsData?.boms || [];
  const totalBoms = bomsData?.total || 0;

  // Calculate analytics
  const analytics = {
    totalProjects: totalBoms,
    activeProjects: boms.filter(b => b.status === 'active').length,
    completedProjects: boms.filter(b => b.status === 'completed').length,
    totalValue: boms.reduce((sum, b) => sum + b.total_cost, 0),
    averageProjectValue: totalBoms > 0 ? boms.reduce((sum, b) => sum + b.total_cost, 0) / totalBoms : 0
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Project Portfolio</h1>
                <p className="text-gray-600 mt-1">Manage your construction projects and BOMs</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Analytics
                </button>
                
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <BuildingOffice2Icon className="h-4 w-4 mr-2" />
                  Templates
                </button>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Project
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        {showAnalytics && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Portfolio Analytics</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.totalProjects}</div>
                  <div className="text-sm text-gray-600">Total Projects</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analytics.activeProjects}</div>
                  <div className="text-sm text-gray-600">Active Projects</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{analytics.completedProjects}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{formatCurrency(analytics.totalValue)}</div>
                  <div className="text-sm text-gray-600">Total Value</div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{formatCurrency(analytics.averageProjectValue)}</div>
                  <div className="text-sm text-gray-600">Avg. Project</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates Section */}
        {showTemplates && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Templates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {templatesData?.templates.map((template: BOMTemplate) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {template.project_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span>{template.estimated_items} items</span>
                      <span>{formatCurrency(template.estimated_cost)}</span>
                    </div>
                    <button
                      onClick={() => handleCreateBom({ 
                        title: `New ${template.name}`,
                        project_type: template.project_type,
                        template: template.id 
                      })}
                      className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filters.project_type}
                  onChange={(e) => setFilters(prev => ({ ...prev, project_type: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="infrastructure">Infrastructure</option>
                </select>

                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={`${filters.sort_by}_${filters.sort_order}`}
                  onChange={(e) => {
                    const [sort_by, sort_order] = e.target.value.split('_');
                    setFilters(prev => ({ ...prev, sort_by, sort_order: sort_order as 'asc' | 'desc' }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="updated_at_desc">Recently Updated</option>
                  <option value="created_at_desc">Recently Created</option>
                  <option value="title_asc">Name A-Z</option>
                  <option value="title_desc">Name Z-A</option>
                  <option value="total_cost_desc">Highest Value</option>
                  <option value="total_cost_asc">Lowest Value</option>
                </select>

                {/* View Toggle */}
                <div className="flex border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm font-medium rounded-r-lg border-l transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {bomsLoading && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading projects...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {bomsError && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <div className="text-center">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Projects</h3>
                <p className="text-gray-600">Please try refreshing the page.</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!bomsLoading && !bomsError && boms.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <div className="text-center">
                <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
                <p className="text-gray-600 mb-4">
                  {filters.search || filters.project_type || filters.status 
                    ? 'No projects match your current filters.'
                    : 'Start by creating your first construction project.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Your First Project
                </button>
              </div>
            </div>
          )}

          {/* BOMs Grid/List */}
          {!bomsLoading && !bomsError && boms.length > 0 && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {boms.map((bom: BOM) => (
                <div
                  key={bom.id}
                  className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 ${
                    viewMode === 'list' ? 'flex items-center p-6' : ''
                  }`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      {/* Grid Card */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                              {bom.title}
                            </h3>
                            {bom.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{bom.description}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bom.status)}`}>
                              {getStatusIcon(bom.status)}
                              <span className="ml-1 capitalize">{bom.status}</span>
                            </span>
                            
                            <div className="relative">
                              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Items:</span>
                            <span className="font-medium text-gray-900">{bom.item_count}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Cost:</span>
                            <span className="font-medium text-gray-900">{formatCurrency(bom.total_cost)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Updated:</span>
                            <span className="text-gray-500">{formatDate(bom.updated_at)}</span>
                          </div>
                          {bom.project_type && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Type:</span>
                              <span className="text-gray-500 capitalize">{bom.project_type}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Link
                            to={`/bom/${bom.id}`}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                          
                          <button
                            onClick={() => handleDuplicateBom(bom.id, bom.title)}
                            disabled={duplicateBomMutation.isPending}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteBom(bom.id)}
                            disabled={deleteBomMutation.isPending}
                            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* List Item */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">{bom.title}</h3>
                            {bom.description && (
                              <p className="text-sm text-gray-600 truncate">{bom.description}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-6 ml-6">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bom.status)}`}>
                              {getStatusIcon(bom.status)}
                              <span className="ml-1 capitalize">{bom.status}</span>
                            </span>
                            
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">{bom.item_count} items</div>
                              <div className="text-sm text-gray-500">{formatCurrency(bom.total_cost)}</div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-gray-500">{formatDate(bom.updated_at)}</div>
                              {bom.project_type && (
                                <div className="text-sm text-gray-400 capitalize">{bom.project_type}</div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/bom/${bom.id}`}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                              >
                                <PencilIcon className="h-4 w-4 mr-1" />
                                Edit
                              </Link>
                              
                              <button
                                onClick={() => handleDuplicateBom(bom.id, bom.title)}
                                disabled={duplicateBomMutation.isPending}
                                className="p-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
                              >
                                <DocumentDuplicateIcon className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteBom(bom.id)}
                                disabled={deleteBomMutation.isPending}
                                className="p-2 text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create BOM Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h3>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateBom({
                  title: formData.get('title') as string,
                  description: formData.get('description') as string || undefined,
                  project_type: formData.get('project_type') as string || undefined
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter project title"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Project description (optional)"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="project_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Project Type
                    </label>
                    <select
                      id="project_type"
                      name="project_type"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select type (optional)</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="infrastructure">Infrastructure</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createBomMutation.isPending}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                  >
                    {createBomMutation.isPending ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_BOMLibrary;