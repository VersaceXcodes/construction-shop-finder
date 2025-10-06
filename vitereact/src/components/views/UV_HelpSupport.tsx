import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

// TypeScript interfaces for the help system
interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  user_type: 'all' | 'buyer' | 'seller';
  featured: boolean;
  helpful_votes: number;
  total_votes: number;
  created_at: string;
  updated_at: string;
}

interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  article_count: number;
  user_type: 'all' | 'buyer' | 'seller';
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful_votes: number;
  total_votes: number;
  popular: boolean;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at: string;
  last_response_at: string | null;
}

const UV_HelpSupport: React.FC = () => {
  // Global state
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Local state
  const [activeTab, setActiveTab] = useState<'help' | 'faq' | 'tickets' | 'chat' | 'contact'>('help');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    category: 'general',
    email: currentUser?.email || '',
    attachments: [] as File[]
  });
  const [chatMessage, setChatMessage] = useState('');
  const [showVideoTutorials, setShowVideoTutorials] = useState(false);

  const queryClient = useQueryClient();

  const fetchHelpArticles = async (query?: string, category?: string): Promise<{
    articles: HelpArticle[];
    categories: HelpCategory[];
    featured_articles: HelpArticle[];
  }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const categories: HelpCategory[] = [
      {
        id: 'getting_started',
        name: 'Getting Started',
        description: 'Basic setup and onboarding guides',
        icon: '🚀',
        article_count: 12,
        user_type: 'all'
      },
      {
        id: 'account_management',
        name: 'Account Management',
        description: 'Profile, settings, and account security',
        icon: '👤',
        article_count: 8,
        user_type: 'all'
      },
      {
        id: 'bom_builder',
        name: 'BOM Builder',
        description: 'Creating and managing bill of materials',
        icon: '📋',
        article_count: 15,
        user_type: 'buyer'
      },
      {
        id: 'shop_management',
        name: 'Shop Management',
        description: 'Inventory, pricing, and shop settings',
        icon: '🏪',
        article_count: 20,
        user_type: 'seller'
      },
      {
        id: 'rfq_system',
        name: 'RFQ System',
        description: 'Request for quotes and communication',
        icon: '💬',
        article_count: 10,
        user_type: 'all'
      },
      {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Common issues and solutions',
        icon: '🔧',
        article_count: 18,
        user_type: 'all'
      }
    ];

    const articles: HelpArticle[] = [
      {
        id: 'art_001',
        title: 'How to Create Your First BOM',
        content: 'Step-by-step guide to creating your first Bill of Materials project...',
        category: 'bom_builder',
        tags: ['bom', 'tutorial', 'beginner'],
        user_type: 'buyer',
        featured: true,
        helpful_votes: 45,
        total_votes: 50,
        created_at: '2023-12-01T10:00:00Z',
        updated_at: '2023-12-15T10:00:00Z'
      },
      {
        id: 'art_002',
        title: 'Setting Up Your Shop Profile',
        content: 'Complete guide to setting up your shop profile and verification...',
        category: 'shop_management',
        tags: ['shop', 'setup', 'verification'],
        user_type: 'seller',
        featured: true,
        helpful_votes: 38,
        total_votes: 42,
        created_at: '2023-12-02T10:00:00Z',
        updated_at: '2023-12-16T10:00:00Z'
      },
      {
        id: 'art_003',
        title: 'Understanding Price Comparison',
        content: 'Learn how to effectively compare prices across different shops...',
        category: 'getting_started',
        tags: ['prices', 'comparison', 'shopping'],
        user_type: 'all',
        featured: true,
        helpful_votes: 52,
        total_votes: 55,
        created_at: '2023-12-03T10:00:00Z',
        updated_at: '2023-12-17T10:00:00Z'
      },
      {
        id: 'art_004',
        title: 'Password Reset and Account Recovery',
        content: 'Steps to recover your account if you forgot your password...',
        category: 'account_management',
        tags: ['password', 'recovery', 'security'],
        user_type: 'all',
        featured: false,
        helpful_votes: 23,
        total_votes: 28,
        created_at: '2023-12-04T10:00:00Z',
        updated_at: '2023-12-18T10:00:00Z'
      },
      {
        id: 'art_005',
        title: 'Using the RFQ System Effectively',
        content: 'Best practices for creating and managing request for quotes...',
        category: 'rfq_system',
        tags: ['rfq', 'communication', 'quotes'],
        user_type: 'all',
        featured: false,
        helpful_votes: 31,
        total_votes: 35,
        created_at: '2023-12-05T10:00:00Z',
        updated_at: '2023-12-19T10:00:00Z'
      }
    ];

    // Filter articles based on query and category
    let filteredArticles = articles;
    
    if (query) {
      filteredArticles = filteredArticles.filter(article => 
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }
    
    if (category && category !== 'all') {
      filteredArticles = filteredArticles.filter(article => article.category === category);
    }

    // Filter by user type if user is authenticated
    if (currentUser) {
      filteredArticles = filteredArticles.filter(article => 
        article.user_type === 'all' || article.user_type === currentUser.user_type
      );
    }

    const featuredArticles = filteredArticles.filter(article => article.featured);

    return {
      articles: filteredArticles,
      categories: categories,
      featured_articles: featuredArticles
    };
  };

  const fetchFAQs = async (): Promise<{
    categories: string[];
    questions: FAQItem[];
    popular_questions: FAQItem[];
  }> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const faqs: FAQItem[] = [
      {
        id: 'faq_001',
        question: 'How do I create an account?',
        answer: 'Click the "Sign Up" button in the top right corner and follow the registration process. You can choose between a buyer or seller account type.',
        category: 'Account',
        helpful_votes: 89,
        total_votes: 95,
        popular: true
      },
      {
        id: 'faq_002',
        question: 'What is the difference between buyer and seller accounts?',
        answer: 'Buyer accounts can create BOMs, compare prices, and send RFQs. Seller accounts can manage shop inventory, respond to RFQs, and update pricing.',
        category: 'Account',
        helpful_votes: 76,
        total_votes: 82,
        popular: true
      },
      {
        id: 'faq_003',
        question: 'How do I add items to my BOM?',
        answer: 'Search for products, click "Add to BOM" on product cards, or use the barcode scanner to quickly add items to your current project.',
        category: 'BOM',
        helpful_votes: 65,
        total_votes: 70,
        popular: true
      },
      {
        id: 'faq_004',
        question: 'Can I compare prices across multiple shops?',
        answer: 'Yes! Use the comparison feature to view prices from different shops side-by-side. You can also see which combination of shops offers the best total price.',
        category: 'Shopping',
        helpful_votes: 58,
        total_votes: 63,
        popular: true
      },
      {
        id: 'faq_005',
        question: 'How do I update my shop inventory?',
        answer: 'Go to Shop Dashboard > Inventory Manager. You can add new products, update stock levels, and modify pricing from this interface.',
        category: 'Shop Management',
        helpful_votes: 42,
        total_votes: 48,
        popular: false
      },
      {
        id: 'faq_006',
        question: 'What payment methods are accepted?',
        answer: 'We support various payment methods including credit cards, bank transfers, and cash payments. Payment is handled directly between buyers and sellers.',
        category: 'Payments',
        helpful_votes: 38,
        total_votes: 44,
        popular: false
      }
    ];

    const categories = [...new Set(faqs.map(faq => faq.category))];
    const popularQuestions = faqs.filter(faq => faq.popular);

    return {
      categories,
      questions: faqs,
      popular_questions: popularQuestions
    };
  };

  const fetchSupportTickets = async (): Promise<{
    tickets: SupportTicket[];
    active_count: number;
    resolved_count: number;
  }> => {
    if (!authToken) throw new Error('Authentication required');
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const tickets: SupportTicket[] = [
      {
        id: 'ticket_001',
        subject: 'Cannot upload inventory photos',
        message: 'Having trouble uploading product photos to my inventory. The upload seems to fail after selecting the files.',
        status: 'in_progress',
        priority: 'normal',
        category: 'technical',
        created_at: '2023-12-20T09:30:00Z',
        updated_at: '2023-12-21T14:20:00Z',
        last_response_at: '2023-12-21T14:20:00Z'
      },
      {
        id: 'ticket_002',
        subject: 'Question about pricing strategy',
        message: 'What are the best practices for competitive pricing in the Dubai market?',
        status: 'resolved',
        priority: 'low',
        category: 'business',
        created_at: '2023-12-18T16:45:00Z',
        updated_at: '2023-12-19T11:30:00Z',
        last_response_at: '2023-12-19T11:30:00Z'
      }
    ];

    const activeCount = tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
    const resolvedCount = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;

    return {
      tickets: tickets,
      active_count: activeCount,
      resolved_count: resolvedCount
    };
  };

  // Queries
  const { data: helpData, isLoading: helpLoading } = useQuery({
    queryKey: ['help-articles', searchQuery, selectedCategory],
    queryFn: () => fetchHelpArticles(searchQuery, selectedCategory),
    staleTime: 5 * 60 * 1000
  });

  const { data: faqData, isLoading: faqLoading } = useQuery({
    queryKey: ['faq-data'],
    queryFn: fetchFAQs,
    staleTime: 10 * 60 * 1000
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: fetchSupportTickets,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000
  });

  // Mutations
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: {
      subject: string;
      message: string;
      priority: string;
      category: string;
    }) => {
      if (!authToken) throw new Error('Authentication required');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTicket: SupportTicket = {
        id: `ticket_${Date.now()}`,
        subject: ticketData.subject,
        message: ticketData.message,
        status: 'open',
        priority: ticketData.priority as any,
        category: ticketData.category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_response_at: null
      };
      
      return newTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setContactForm({
        subject: '',
        message: '',
        priority: 'normal',
        category: 'general',
        email: currentUser?.email || '',
        attachments: []
      });
      setActiveTab('tickets');
    }
  });

  const rateHelpfulnessMutation = useMutation({
    mutationFn: async ({ helpful }: { articleId: string; helpful: boolean }) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { success: true, helpful };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help-articles'] });
    }
  });

  // Event handlers
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Query will automatically refetch due to searchQuery dependency
  };

  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please sign in to submit a support ticket');
      return;
    }
    createTicketMutation.mutate({
      subject: contactForm.subject,
      message: contactForm.message,
      priority: contactForm.priority,
      category: contactForm.category
    });
  };

  const handleRateArticle = (articleId: string, helpful: boolean) => {
    rateHelpfulnessMutation.mutate({ articleId, helpful });
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const videoTutorials = [
    {
      id: 'vid_001',
      title: 'Getting Started with ConstructHub',
      duration: '5:30',
      thumbnail: '🎥',
      category: 'Beginner'
    },
    {
      id: 'vid_002',
      title: 'Creating Your First BOM',
      duration: '8:45',
      thumbnail: '🎥',
      category: 'BOM Builder'
    },
    {
      id: 'vid_003',
      title: 'Shop Setup and Verification',
      duration: '6:20',
      thumbnail: '🎥',
      category: 'Shop Management'
    },
    {
      id: 'vid_004',
      title: 'Using the Price Comparison Tool',
      duration: '4:15',
      thumbnail: '🎥',
      category: 'Shopping'
    }
  ];

  const contactChannels = [
    {
      name: 'Email Support',
      value: 'support@constructhub.com',
      icon: '📧',
      description: 'General inquiries and support requests',
      response_time: '24 hours'
    },
    {
      name: 'Technical Support',
      value: 'tech@constructhub.com',
      icon: '🔧',
      description: 'Technical issues and bug reports',
      response_time: '12 hours'
    },
    {
      name: 'Sales Inquiries',
      value: 'sales@constructhub.com',
      icon: '💼',
      description: 'Business partnerships and sales',
      response_time: '8 hours'
    },
    {
      name: 'Phone Support',
      value: '+971 4 123 4567',
      icon: '📞',
      description: 'Urgent support (Business hours)',
      response_time: 'Immediate'
    }
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Support Center</h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Find answers, get help, and learn how to make the most of ConstructHub
              </p>
            </div>

            {/* Search Bar */}
            <div className="mt-8 max-w-2xl mx-auto">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search help articles, FAQs, tutorials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-12 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-lg transition-all duration-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={resetSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {[
                { id: 'help', label: 'Help Articles', icon: '📚' },
                { id: 'faq', label: 'FAQ', icon: '❓' },
                { id: 'tickets', label: 'Support Tickets', icon: '🎫', auth: true },
                { id: 'chat', label: 'Live Chat', icon: '💬', auth: true },
                { id: 'contact', label: 'Contact Us', icon: '📞' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  disabled={tab.auth && !isAuthenticated}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : tab.auth && !isAuthenticated
                      ? 'border-transparent text-gray-400 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  {tab.auth && !isAuthenticated && (
                    <span className="ml-1 text-xs text-gray-400">(Sign in required)</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Help Articles Tab */}
          {activeTab === 'help' && (
            <div className="space-y-8">
              {/* Featured Articles */}
              {helpData?.featured_articles && helpData.featured_articles.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Articles</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {helpData.featured_articles.map((article) => (
                      <div key={article.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
                        <div className="p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                            {article.content}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {helpData.categories?.find(cat => cat.id === article.category)?.name || article.category}
                              </span>
                              {article.user_type !== 'all' && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  article.user_type === 'buyer' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {article.user_type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleRateArticle(article.id, true)}
                                className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
                              >
                                👍 {article.helpful_votes}
                              </button>
                              <button
                                onClick={() => handleRateArticle(article.id, false)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                              >
                                👎 {article.total_votes - article.helpful_votes}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {helpData?.categories && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {helpData.categories
                      .filter(category => !currentUser || category.user_type === 'all' || category.user_type === currentUser.user_type)
                      .map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                          selectedCategory === category.id
                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div className="text-3xl mb-3">{category.icon}</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
                        <p className="text-gray-600 text-sm mb-3">{category.description}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {category.article_count} articles
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Tutorials */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Video Tutorials</h2>
                  <button
                    onClick={() => setShowVideoTutorials(!showVideoTutorials)}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    {showVideoTutorials ? 'Hide Videos' : 'Show All Videos'}
                  </button>
                </div>
                
                {showVideoTutorials && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {videoTutorials.map((video) => (
                      <div key={video.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer">
                        <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <div className="text-6xl text-white">{video.thumbnail}</div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{video.title}</h3>
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>{video.duration}</span>
                            <span className="bg-gray-100 px-2 py-1 rounded">{video.category}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchQuery && helpData?.articles && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Search Results for "{searchQuery}" ({helpData.articles.length} found)
                  </h2>
                  <div className="space-y-4">
                    {helpData.articles.map((article) => (
                      <div key={article.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{article.title}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-3">{article.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {article.tags.map((tag) => (
                              <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRateArticle(article.id, true)}
                              className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
                            >
                              👍 {article.helpful_votes}
                            </button>
                            <button
                              onClick={() => handleRateArticle(article.id, false)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                            >
                              👎 {article.total_votes - article.helpful_votes}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {helpLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-8">
              {faqData?.popular_questions && faqData.popular_questions.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Most Popular Questions</h2>
                  <div className="space-y-4">
                    {faqData.popular_questions.map((faq) => (
                      <div key={faq.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        <details className="group">
                          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-gray-50 transition-colors">
                            <h3 className="font-semibold text-gray-900 pr-4">{faq.question}</h3>
                            <div className="flex items-center space-x-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {faq.category}
                              </span>
                              <svg className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </summary>
                          <div className="px-6 pb-6">
                            <p className="text-gray-600 leading-relaxed mb-4">{faq.answer}</p>
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-500">
                                Was this helpful?
                              </div>
                              <div className="flex items-center space-x-2">
                                <button className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors">
                                  👍 {faq.helpful_votes}
                                </button>
                                <button className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors">
                                  👎 {faq.total_votes - faq.helpful_votes}
                                </button>
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {faqData?.categories && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse FAQ by Category</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {faqData.categories.map((category) => {
                      const categoryQuestions = faqData.questions.filter(q => q.category === category);
                      return (
                        <div key={category} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
                          <div className="space-y-3">
                            {categoryQuestions.slice(0, 3).map((faq) => (
                              <details key={faq.id} className="group">
                                <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 transition-colors">
                                  {faq.question}
                                </summary>
                                <p className="mt-2 text-sm text-gray-600 pl-4">{faq.answer}</p>
                              </details>
                            ))}
                          </div>
                          {categoryQuestions.length > 3 && (
                            <p className="mt-4 text-sm text-blue-600 font-medium">
                              +{categoryQuestions.length - 3} more questions
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {faqLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          )}

          {/* Support Tickets Tab */}
          {activeTab === 'tickets' && (
            <div className="space-y-8">
              {!isAuthenticated ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔒</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
                  <p className="text-gray-600 mb-6">Please sign in to access your support tickets</p>
                  <Link
                    to="/login"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                </div>
              ) : (
                <>
                  {/* Ticket Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center">
                      <div className="text-3xl text-orange-500 mb-2">📋</div>
                      <div className="text-2xl font-bold text-gray-900">{ticketsData?.active_count || 0}</div>
                      <div className="text-gray-600">Active Tickets</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center">
                      <div className="text-3xl text-green-500 mb-2">✅</div>
                      <div className="text-2xl font-bold text-gray-900">{ticketsData?.resolved_count || 0}</div>
                      <div className="text-gray-600">Resolved</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center">
                      <div className="text-3xl text-blue-500 mb-2">💬</div>
                      <div className="text-2xl font-bold text-gray-900">{(ticketsData?.tickets.length || 0)}</div>
                      <div className="text-gray-600">Total Tickets</div>
                    </div>
                  </div>

                  {/* Create New Ticket */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Support Ticket</h2>
                    <form onSubmit={handleContactFormSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                          </label>
                          <select
                            id="category"
                            value={contactForm.category}
                            onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                            className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          >
                            <option value="general">General Support</option>
                            <option value="technical">Technical Issue</option>
                            <option value="account">Account Management</option>
                            <option value="billing">Billing & Payments</option>
                            <option value="business">Business Inquiry</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                          </label>
                          <select
                            id="priority"
                            value={contactForm.priority}
                            onChange={(e) => setContactForm(prev => ({ ...prev, priority: e.target.value as any }))}
                            className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                          Subject
                        </label>
                        <input
                          type="text"
                          id="subject"
                          value={contactForm.subject}
                          onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                          required
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          placeholder="Brief description of your issue"
                        />
                      </div>
                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                          Message
                        </label>
                        <textarea
                          id="message"
                          rows={5}
                          value={contactForm.message}
                          onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                          required
                          className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          placeholder="Describe your issue in detail..."
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={createTicketMutation.isPending}
                          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {createTicketMutation.isPending ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Creating Ticket...
                            </span>
                          ) : (
                            'Create Ticket'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Ticket History */}
                  {ticketsData?.tickets && ticketsData.tickets.length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-6">Your Support Tickets</h2>
                      <div className="space-y-4">
                        {ticketsData.tickets.map((ticket) => (
                          <div key={ticket.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{ticket.subject}</h3>
                                <p className="text-gray-600 text-sm">{ticket.message}</p>
                              </div>
                              <div className="flex flex-col items-end space-y-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {ticket.status.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  ticket.priority === 'low' ? 'bg-gray-100 text-gray-800' :
                                  ticket.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                                  ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {ticket.priority.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                              <span>Last updated: {new Date(ticket.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticketsLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Live Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-8">
              {!isAuthenticated ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔒</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
                  <p className="text-gray-600 mb-6">Please sign in to start a live chat session</p>
                  <Link
                    to="/login"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                      <h2 className="text-xl font-bold text-white">Live Chat Support</h2>
                      <p className="text-blue-100">Get instant help from our support team</p>
                    </div>
                    
                    <div className="p-6">
                      <div className="mb-6">
                        <div className="flex items-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                          <div>
                            <p className="font-medium text-green-800">Support agents are online</p>
                            <p className="text-sm text-green-600">Average response time: 2-3 minutes</p>
                          </div>
                        </div>
                      </div>

                      <div className="h-96 border-2 border-gray-200 rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50">
                        <div className="space-y-4">
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">CS</span>
                            </div>
                            <div className="flex-1">
                              <div className="bg-white rounded-lg p-3 shadow-sm">
                                <p className="text-sm text-gray-900">
                                  Hello! Welcome to ConstructHub support. How can I help you today?
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Customer Support • Just now</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-4">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              // Handle send message
                              setChatMessage('');
                            }
                          }}
                        />
                        <button
                          onClick={() => setChatMessage('')}
                          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                        >
                          Send
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                        <span>Chat is encrypted and secure</span>
                        <span>Powered by ConstructHub Support</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contact Us Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Get in Touch</h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Choose the best way to reach us. We're here to help!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {contactChannels.map((channel) => (
                  <div key={channel.name} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{channel.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{channel.name}</h3>
                        <p className="text-gray-600 text-sm mb-3">{channel.description}</p>
                        <div className="space-y-2">
                          <p className="font-medium text-blue-600">{channel.value}</p>
                          <p className="text-sm text-gray-500">Response time: {channel.response_time}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Business Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Customer Support</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monday - Friday</span>
                        <span>8:00 AM - 8:00 PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saturday</span>
                        <span>9:00 AM - 5:00 PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sunday</span>
                        <span>Closed</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Technical Support</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monday - Friday</span>
                        <span>24/7</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Weekend</span>
                        <span>Emergency only</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white text-center">
                <h3 className="text-2xl font-bold mb-4">Need Immediate Help?</h3>
                <p className="text-blue-100 mb-6">
                  For urgent technical issues or critical business matters, contact our emergency support line
                </p>
                <div className="flex items-center justify-center space-x-8">
                  <div>
                    <p className="font-semibold">Emergency Hotline</p>
                    <p className="text-xl">+971 4 999 8888</p>
                  </div>
                  <div className="text-4xl">📱</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_HelpSupport;