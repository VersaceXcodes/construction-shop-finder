import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Search, Mic, Camera, Clock, X, ArrowRight, Star, MapPin } from 'lucide-react';

// TypeScript interfaces
interface SearchSuggestion {
  text: string;
  type: 'product' | 'shop' | 'category';
  id: string | null;
  category: string | null;
  metadata?: {
    image_url?: string;
    rating?: number;
    location?: string;
    verified?: boolean;
  };
}

const GV_SearchBar: React.FC = () => {
  // Global state access
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const language = useAppStore(state => state.app_preferences.language);
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [voiceRecognitionActive, setVoiceRecognitionActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Check mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Adaptive placeholder based on current view
  const getPlaceholder = useCallback(() => {
    const placeholders = {
      ar: {
        default: 'ابحث عن مواد البناء...',
        '/': 'ابحث في آلاف المنتجات...',
        '/search': 'حسّن البحث أو جرب شيئاً جديداً...',
        '/product': 'ابحث عن منتجات مشابهة...',
        '/compare': 'أضف منتجات للمقارنة...',
        '/bom': 'ابحث لإضافة مواد للمشروع...',
        '/categories': 'ابحث في هذه الفئة...',
        '/map': 'ابحث عن محلات قريبة...'
      },
      en: {
        default: 'Search for construction materials...',
        '/': 'Search thousands of products...',
        '/search': 'Refine your search or try something new...',
        '/product': 'Search for similar products...',
        '/compare': 'Add products to compare...',
        '/bom': 'Search to add materials to project...',
        '/categories': 'Search within this category...',
        '/map': 'Search for nearby shops...'
      }
    };

    const currentLang = language === 'ar' ? 'ar' : 'en';
    const currentPlaceholders = placeholders[currentLang];
    
    // Find the most specific match for current path
    const pathKeys = Object.keys(currentPlaceholders).filter(key => key !== 'default');
    const matchingPath = pathKeys.find(path => location.pathname.startsWith(path));
    
    return currentPlaceholders[matchingPath || 'default'];
  }, [location.pathname, language]);

  // Debounced search suggestions
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['search-suggestions', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/search/suggestions`,
        {
          params: {
            q: searchQuery,
            type: 'all',
            limit: 8
          }
        }
      );
      
      return response.data.suggestions.map((item: any) => ({
        text: item.text,
        type: item.type,
        id: item.id,
        category: item.metadata?.category || null,
        metadata: item.metadata
      }));
    },
    enabled: searchQuery.length >= 2 && showSuggestions,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Search history query
  const { data: searchHistory = [] } = useQuery({
    queryKey: ['search-history'],
    queryFn: async () => {
      if (!isAuthenticated || !authToken) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/search/history`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { limit: 10 }
        }
      );
      
      return response.data.searches;
    },
    enabled: isAuthenticated && !!authToken,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      if (!isAuthenticated || !authToken) return;
      
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/search/history`,
        {
          query,
          results_count: 0 // Will be updated after search results
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    }
  });

  // Voice recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'ar' ? 'ar-AE' : 'en-US';
      
      recognition.onstart = () => {
        setVoiceRecognitionActive(true);
      };
      
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setVoiceTranscript(transcript);
        if (event.results[event.resultIndex].isFinal) {
          setSearchQuery(transcript);
          setVoiceRecognitionActive(false);
          handleSearch(transcript);
        }
      };
      
      recognition.onerror = () => {
        setVoiceRecognitionActive(false);
        setVoiceTranscript('');
      };
      
      recognition.onend = () => {
        setVoiceRecognitionActive(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, [language]);

  // Handle search execution
  const handleSearch = useCallback((query: string = searchQuery) => {
    if (!query.trim()) return;
    
    // Save to history if authenticated
    if (isAuthenticated) {
      saveSearchMutation.mutate(query);
    }
    
    // Navigate to search results
    const searchParams = new URLSearchParams({
      q: query.trim()
    });
    
    navigate(`/search?${searchParams.toString()}`);
    
    // Reset UI state
    setShowSuggestions(false);
    setShowHistory(false);
    setIsExpanded(false);
    searchInputRef.current?.blur();
  }, [searchQuery, isAuthenticated, navigate, saveSearchMutation]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Show suggestions after delay
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        setShowSuggestions(true);
        setShowHistory(false);
      }, 300);
    } else {
      setShowSuggestions(false);
    }
  }, []);

  // Handle input focus
  const handleInputFocus = () => {
    setIsExpanded(true);
    
    if (searchQuery.length >= 2) {
      setShowSuggestions(true);
    } else if (isAuthenticated && searchHistory.length > 0) {
      setShowHistory(true);
    }
  };

  // Handle input blur
  const handleInputBlur = (e: React.FocusEvent) => {
    // Delay to allow clicking on suggestions
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
        setShowSuggestions(false);
        setShowHistory(false);
        if (!searchQuery && isMobile) {
          setIsExpanded(false);
        }
      }
    }, 150);
  };

  // Voice recognition handlers
  const startVoiceRecognition = () => {
    if (recognitionRef.current) {
      setVoiceTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceRecognitionActive(false);
  };

  // Barcode scanner handler
  const openBarcodeScanner = () => {
    navigate('/scan');
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowHistory(false);
      if (isMobile && !searchQuery) {
        setIsExpanded(false);
      }
    }
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'shop':
        return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'category':
        return <Star className="w-4 h-4 text-yellow-500" />;
      default:
        return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <>
      <div className={`relative ${isMobile ? 'w-full' : 'max-w-2xl'} mx-auto`}>
        {/* Mobile overlay */}
        {isMobile && isExpanded && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={() => {
              if (!searchQuery) {
                setIsExpanded(false);
                setShowSuggestions(false);
                setShowHistory(false);
              }
            }}
          />
        )}
        
        {/* Search container */}
        <div className={`
          relative z-50 transition-all duration-300 ease-in-out
          ${isMobile && isExpanded ? 'fixed top-4 left-4 right-4' : ''}
          ${isMobile && !isExpanded ? 'w-12 h-12' : ''}
        `}>
          {/* Main search input */}
          <div className={`
            relative bg-white rounded-xl shadow-lg border-2 border-gray-200 
            focus-within:border-blue-500 focus-within:shadow-xl transition-all duration-200
            ${isMobile && !isExpanded ? 'w-12 h-12 justify-center items-center flex' : 'w-full'}
          `}>
            {/* Search icon or expanded input */}
            {isMobile && !isExpanded ? (
              <button
                onClick={() => setIsExpanded(true)}
                className="w-full h-full flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
                aria-label={language === 'ar' ? 'فتح البحث' : 'Open search'}
              >
                <Search className="w-5 h-5" />
              </button>
            ) : (
              <>
                {/* Search input field */}
                <div className="flex items-center px-4 py-3">
                  <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                  
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={voiceRecognitionActive ? voiceTranscript : searchQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    className={`
                      w-full bg-transparent border-none outline-none text-gray-900 
                      placeholder-gray-500 text-base leading-relaxed
                      ${language === 'ar' ? 'text-right' : 'text-left'}
                    `}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  
                  {/* Voice recognition button */}
                  <button
                    onClick={voiceRecognitionActive ? stopVoiceRecognition : startVoiceRecognition}
                    className={`
                      ml-2 p-2 rounded-lg transition-all duration-200 flex-shrink-0
                      ${voiceRecognitionActive 
                        ? 'bg-red-100 text-red-600 animate-pulse' 
                        : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'
                      }
                    `}
                    aria-label={language === 'ar' ? 'البحث الصوتي' : 'Voice search'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  
                  {/* Barcode scanner button */}
                  <button
                    onClick={openBarcodeScanner}
                    className="ml-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-all duration-200 flex-shrink-0"
                    aria-label={language === 'ar' ? 'مسح الباركود' : 'Scan barcode'}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  
                  {/* Mobile cancel button */}
                  {isMobile && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setIsExpanded(false);
                        setShowSuggestions(false);
                        setShowHistory(false);
                      }}
                      className="ml-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-all duration-200 flex-shrink-0"
                      aria-label={language === 'ar' ? 'إلغاء' : 'Cancel'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Voice recognition status */}
                {voiceRecognitionActive && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-700 text-sm font-medium">
                        {language === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
                      </span>
                    </div>
                    {voiceTranscript && (
                      <p className="text-center text-gray-700 text-sm mt-2 italic">
                        "{voiceTranscript}"
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Suggestions and history dropdown */}
          {(showSuggestions || showHistory) && (isExpanded || !isMobile) && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50"
            >
              {/* Loading state */}
              {suggestionsLoading && showSuggestions && (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 text-sm mt-2">
                    {language === 'ar' ? 'جاري البحث...' : 'Searching...'}
                  </p>
                </div>
              )}
              
              {/* Search suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700">
                      {language === 'ar' ? 'اقتراحات البحث' : 'Search Suggestions'}
                    </h4>
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.id || index}`}
                      onClick={() => handleSearch(suggestion.text)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                    >
                      <div className="flex items-center space-x-3">
                        {getSuggestionIcon(suggestion.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 font-medium truncate">
                            {suggestion.text}
                          </p>
                          {suggestion.category && (
                            <p className="text-gray-500 text-sm truncate">
                              {language === 'ar' ? 'في' : 'in'} {suggestion.category}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Search history */}
              {showHistory && searchHistory.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700">
                      {language === 'ar' ? 'عمليات البحث الأخيرة' : 'Recent Searches'}
                    </h4>
                  </div>
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(item.query)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                    >
                      <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 truncate">{item.query}</p>
                          <p className="text-gray-500 text-xs">
                            {new Date(item.timestamp).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US')}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* No results */}
              {showSuggestions && !suggestionsLoading && suggestions.length === 0 && searchQuery.length >= 2 && (
                <div className="p-4 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">
                    {language === 'ar' ? 'لا توجد اقتراحات متاحة' : 'No suggestions available'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_SearchBar;