import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  StarIcon,
  FlagIcon,
  CheckIcon,
  TagIcon,
  ClockIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  BookmarkIcon,
  ShareIcon,
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

// Types
interface Question {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    reputation_score: number;
    badges: string[];
    is_expert: boolean;
  };
  category: string;
  tags: string[];
  votes: number;
  answers_count: number;
  has_best_answer: boolean;
  created_at: string;
  updated_at: string;
}

interface Answer {
  id: string;
  question_id: string;
  content: string;
  author: {
    id: string;
    name: string;
    reputation_score: number;
    badges: string[];
    is_expert: boolean;
  };
  votes: number;
  is_best_answer: boolean;
  is_helpful: boolean;
  created_at: string;
  updated_at: string;
}

interface SearchFilters {
  query: string;
  category: string | null;
  tags: string[];
  sort_by: string;
  answered_only: boolean;
}

interface UserReputation {
  reputation_score: number;
  badges: string[];
  questions_asked: number;
  answers_given: number;
  helpful_votes: number;
}

// Mock data
const mockCategories = [
  'Technical Specifications',
  'Product Recommendations', 
  'Installation Guidance',
  'Troubleshooting',
  'Safety Standards',
  'Material Compatibility',
  'Cost Estimation',
  'Industry Best Practices'
];

const mockTags = [
  'cement', 'steel', 'concrete', 'foundation', 'roofing', 'plumbing', 
  'electrical', 'insulation', 'waterproofing', 'safety', 'tools', 'equipment'
];

const mockQuestions: Question[] = [
  {
    id: 'q1',
    title: 'What type of cement is best for foundation work in Dubai climate?',
    content: 'I\'m planning a residential foundation project in Dubai and need advice on the most suitable cement type considering the high temperature and humidity. Should I use OPC 43 grade or go for PPC?',
    author: {
      id: 'u1',
      name: 'Ahmed Hassan',
      reputation_score: 2840,
      badges: ['Verified Contractor', 'Foundation Expert'],
      is_expert: true
    },
    category: 'Technical Specifications',
    tags: ['cement', 'foundation', 'dubai', 'climate'],
    votes: 15,
    answers_count: 7,
    has_best_answer: true,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-16T14:20:00Z'
  },
  {
    id: 'q2',
    title: 'Steel reinforcement spacing for residential slabs - UAE building code compliance',
    content: 'What are the minimum spacing requirements for steel reinforcement in residential slabs according to UAE building codes? I\'m working on a 2-story villa project.',
    author: {
      id: 'u2',
      name: 'Sarah Al-Mahmoud',
      reputation_score: 1560,
      badges: ['Structural Engineer'],
      is_expert: true
    },
    category: 'Safety Standards',
    tags: ['steel', 'reinforcement', 'building-code', 'uae'],
    votes: 22,
    answers_count: 4,
    has_best_answer: false,
    created_at: '2024-01-14T16:45:00Z',
    updated_at: '2024-01-15T09:30:00Z'
  },
  {
    id: 'q3',
    title: 'Waterproofing membrane installation in basement construction',
    content: 'I need guidance on proper waterproofing membrane installation for basement walls. What\'s the recommended sequence and best practices for UAE conditions?',
    author: {
      id: 'u3',
      name: 'Mohammad Rizvi',
      reputation_score: 890,
      badges: ['Active Contributor'],
      is_expert: false
    },
    category: 'Installation Guidance',
    tags: ['waterproofing', 'basement', 'membrane'],
    votes: 8,
    answers_count: 3,
    has_best_answer: true,
    created_at: '2024-01-13T11:20:00Z',
    updated_at: '2024-01-14T08:15:00Z'
  }
];

const mockAnswers: Answer[] = [
  {
    id: 'a1',
    question_id: 'q1',
    content: 'For Dubai\'s climate, I highly recommend using PPC (Portland Pozzolan Cement) for foundation work. It offers better durability against sulfate attack and generates less heat of hydration, which is crucial in hot climates. The pozzolanic materials improve long-term strength and reduce permeability.',
    author: {
      id: 'u4',
      name: 'Dr. Khalid Al-Rashid',
      reputation_score: 4920,
      badges: ['Verified Expert', 'Materials Engineer', 'Top Contributor'],
      is_expert: true
    },
    votes: 18,
    is_best_answer: true,
    is_helpful: true,
    created_at: '2024-01-15T12:45:00Z',
    updated_at: '2024-01-15T12:45:00Z'
  },
  {
    id: 'a2',
    question_id: 'q1',
    content: 'While PPC is good, OPC 43 grade can also work well if you ensure proper curing practices. The key is maintaining adequate moisture and temperature control during the initial 28 days. Consider using curing compounds in Dubai\'s heat.',
    author: {
      id: 'u5',
      name: 'Rajesh Kumar',
      reputation_score: 2100,
      badges: ['Site Supervisor', 'Quality Control'],
      is_expert: false
    },
    votes: 8,
    is_best_answer: false,
    is_helpful: true,
    created_at: '2024-01-15T15:20:00Z',
    updated_at: '2024-01-15T15:20:00Z'
  }
];

const UV_CommunityQA: React.FC = () => {
  // Global state
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Local state
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    category: null,
    tags: [],
    sort_by: 'recent',
    answered_only: false
  });
  const [userReputation] = useState<UserReputation>({
    reputation_score: currentUser ? 1250 : 0,
    badges: currentUser ? ['Active Contributor', 'Helpful Member'] : [],
    questions_asked: currentUser ? 12 : 0,
    answers_given: currentUser ? 34 : 0,
    helpful_votes: currentUser ? 89 : 0
  });

  // Form states
  const [newQuestion, setNewQuestion] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    attachments: [] as File[]
  });
  const [newAnswer, setNewAnswer] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Mock data with filtering
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>(mockQuestions);
  const [questionAnswers, setQuestionAnswers] = useState<Answer[]>([]);

  // Filter questions based on search criteria
  useEffect(() => {
    let filtered = [...mockQuestions];

    if (searchFilters.query) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        q.content.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        q.tags.some(tag => tag.toLowerCase().includes(searchFilters.query.toLowerCase()))
      );
    }

    if (searchFilters.category) {
      filtered = filtered.filter(q => q.category === searchFilters.category);
    }

    if (searchFilters.tags.length > 0) {
      filtered = filtered.filter(q => 
        searchFilters.tags.some(tag => q.tags.includes(tag))
      );
    }

    if (searchFilters.answered_only) {
      filtered = filtered.filter(q => q.answers_count > 0);
    }

    // Sort
    switch (searchFilters.sort_by) {
      case 'votes':
        filtered.sort((a, b) => b.votes - a.votes);
        break;
      case 'answers':
        filtered.sort((a, b) => b.answers_count - a.answers_count);
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredQuestions(filtered);
  }, [searchFilters]);

  // Load answers when question is selected
  useEffect(() => {
    if (selectedQuestion) {
      const answers = mockAnswers.filter(a => a.question_id === selectedQuestion.id);
      setQuestionAnswers(answers);
    }
  }, [selectedQuestion]);

  // Handlers
  const handleQuestionClick = (question: Question) => {
    setSelectedQuestion(question);
    setView('detail');
  };

  const handleCreateQuestion = () => {
    if (!currentUser) {
      alert('Please login to ask a question');
      return;
    }
    setView('create');
  };

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.title.trim() || !newQuestion.content.trim() || !newQuestion.category) {
      alert('Please fill in all required fields');
      return;
    }

    // In real implementation, this would call the API
    console.log('Creating question:', newQuestion);
    
    // Reset form and go back to list
    setNewQuestion({
      title: '',
      content: '',
      category: '',
      tags: [],
      attachments: []
    });
    setView('list');
    alert('Question submitted successfully!');
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnswer.trim()) {
      alert('Please enter an answer');
      return;
    }

    // In real implementation, this would call the API
    console.log('Submitting answer:', newAnswer);
    setNewAnswer('');
    alert('Answer submitted successfully!');
  };

  const handleVote = (type: 'question' | 'answer', id: string, direction: 'up' | 'down') => {
    if (!currentUser) {
      alert('Please login to vote');
      return;
    }
    
    console.log(`Voting ${direction} on ${type} ${id}`);
    // In real implementation, this would call the API
  };

  const handleMarkBestAnswer = (answerId: string) => {
    if (!currentUser || !selectedQuestion || selectedQuestion.author.id !== currentUser.id) {
      alert('Only question authors can mark best answers');
      return;
    }
    
    console.log('Marking best answer:', answerId);
    // In real implementation, this would call the API
  };

  const addTag = () => {
    if (tagInput.trim() && !newQuestion.tags.includes(tagInput.trim().toLowerCase())) {
      setNewQuestion(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewQuestion(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const renderBadges = (badges: string[], isExpert: boolean) => (
    <div className="flex flex-wrap gap-1">
      {isExpert && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          <CheckIconSolid className="w-3 h-3" />
          Expert
        </span>
      )}
      {badges.map(badge => (
        <span key={badge} className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
          {badge}
        </span>
      ))}
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">Community Q&A</h1>
                {view !== 'list' && (
                  <button
                    onClick={() => {
                      setView('list');
                      setSelectedQuestion(null);
                    }}
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ← Back to Questions
                  </button>
                )}
              </div>
              
              {currentUser && (
                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm">
                    <div className="font-medium text-gray-900">{currentUser.name}</div>
                    <div className="text-gray-500">
                      {userReputation.reputation_score} reputation points
                    </div>
                  </div>
                  <button
                    onClick={handleCreateQuestion}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Ask Question
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {view === 'list' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Questions
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchFilters.query}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, query: e.target.value }))}
                        placeholder="Search questions..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={searchFilters.category || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, category: e.target.value || null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Categories</option>
                      {mockCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort By
                    </label>
                    <select
                      value={searchFilters.sort_by}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, sort_by: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="votes">Most Voted</option>
                      <option value="answers">Most Answered</option>
                    </select>
                  </div>

                  {/* Answered Only Toggle */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="answered-only"
                      checked={searchFilters.answered_only}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, answered_only: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="answered-only" className="ml-2 text-sm text-gray-700">
                      Answered questions only
                    </label>
                  </div>

                  {/* User Stats */}
                  {currentUser && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Your Activity</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Questions Asked</span>
                          <span className="font-medium">{userReputation.questions_asked}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Answers Given</span>
                          <span className="font-medium">{userReputation.answers_given}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Helpful Votes</span>
                          <span className="font-medium">{userReputation.helpful_votes}</span>
                        </div>
                      </div>
                      {renderBadges(userReputation.badges, false)}
                    </div>
                  )}
                </div>
              </div>

              {/* Questions List */}
              <div className="lg:col-span-3">
                <div className="space-y-4">
                  {filteredQuestions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No questions found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your search filters or be the first to ask!</p>
                      {currentUser && (
                        <button
                          onClick={handleCreateQuestion}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Ask First Question
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredQuestions.map(question => (
                      <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <button
                              onClick={() => handleQuestionClick(question)}
                              className="text-left block w-full"
                            >
                              <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2">
                                {question.title}
                              </h3>
                            </button>
                            
                            <p className="text-gray-600 mb-4 line-clamp-2">
                              {question.content}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                              <div className="flex items-center gap-1">
                                <UserIcon className="w-4 h-4" />
                                <span className="font-medium text-gray-700">{question.author.name}</span>
                                {question.author.is_expert && (
                                  <CheckIconSolid className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" />
                                {formatTimeAgo(question.created_at)}
                              </div>
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                                {question.category}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                              {question.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                                  <TagIcon className="w-3 h-3" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="ml-6 text-right space-y-2">
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-900">{question.votes}</div>
                                <div>votes</div>
                              </div>
                              <div className="text-center">
                                <div className={`text-lg font-semibold ${question.answers_count > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                  {question.answers_count}
                                </div>
                                <div>answers</div>
                              </div>
                            </div>
                            {question.has_best_answer && (
                              <div className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckIconSolid className="w-3 h-3" />
                                Solved
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'detail' && selectedQuestion && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Question Detail */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        {selectedQuestion.title}
                      </h1>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4" />
                          <span className="font-medium text-gray-700">{selectedQuestion.author.name}</span>
                          {selectedQuestion.author.is_expert && (
                            <CheckIconSolid className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="text-gray-400">•</span>
                          <span>{selectedQuestion.author.reputation_score} reputation</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          Asked {formatTimeAgo(selectedQuestion.created_at)}
                        </div>
                      </div>

                      {renderBadges(selectedQuestion.author.badges, selectedQuestion.author.is_expert)}
                    </div>

                    <div className="ml-6 flex flex-col items-center space-y-2">
                      <button
                        onClick={() => handleVote('question', selectedQuestion.id, 'up')}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <ChevronUpIcon className="w-6 h-6" />
                      </button>
                      <span className="text-xl font-semibold text-gray-900">{selectedQuestion.votes}</span>
                      <button
                        onClick={() => handleVote('question', selectedQuestion.id, 'down')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <ChevronDownIcon className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  <div className="prose max-w-none mb-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedQuestion.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedQuestion.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                        <TagIcon className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {selectedQuestion.category}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                        <BookmarkIcon className="w-5 h-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                        <ShareIcon className="w-5 h-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
                        <FlagIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Answers Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {questionAnswers.length} {questionAnswers.length === 1 ? 'Answer' : 'Answers'}
                  </h2>

                  <div className="space-y-6">
                    {questionAnswers.map(answer => (
                      <div key={answer.id} className={`border rounded-xl p-6 ${answer.is_best_answer ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {answer.is_best_answer && (
                              <div className="flex items-center gap-2 text-green-600 font-medium text-sm mb-3">
                                <CheckIconSolid className="w-4 h-4" />
                                Best Answer
                              </div>
                            )}

                            <div className="prose max-w-none mb-4">
                              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {answer.content}
                              </p>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="w-4 h-4" />
                                  <span className="font-medium text-gray-700">{answer.author.name}</span>
                                  {answer.author.is_expert && (
                                    <CheckIconSolid className="w-4 h-4 text-blue-500" />
                                  )}
                                  <span className="text-gray-400">•</span>
                                  <span>{answer.author.reputation_score} reputation</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <ClockIcon className="w-4 h-4" />
                                  {formatTimeAgo(answer.created_at)}
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                {!answer.is_best_answer && currentUser && selectedQuestion.author.id === currentUser.id && (
                                  <button
                                    onClick={() => handleMarkBestAnswer(answer.id)}
                                    className="px-3 py-1 text-sm text-green-600 hover:text-green-700 border border-green-200 hover:border-green-300 rounded-lg transition-colors"
                                  >
                                    Mark as Best
                                  </button>
                                )}
                                <button className="p-1 text-gray-400 hover:text-red-600 rounded">
                                  <FlagIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3">
                              {renderBadges(answer.author.badges, answer.author.is_expert)}
                            </div>
                          </div>

                          <div className="ml-6 flex flex-col items-center space-y-2">
                            <button
                              onClick={() => handleVote('answer', answer.id, 'up')}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <ChevronUpIcon className="w-5 h-5" />
                            </button>
                            <span className="text-lg font-semibold text-gray-900">{answer.votes}</span>
                            <button
                              onClick={() => handleVote('answer', answer.id, 'down')}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <ChevronDownIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Answer Form */}
                  {currentUser && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Your Answer</h3>
                      <form onSubmit={handleSubmitAnswer}>
                        <textarea
                          value={newAnswer}
                          onChange={(e) => setNewAnswer(e.target.value)}
                          placeholder="Share your knowledge and help the community..."
                          rows={6}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                        <div className="flex justify-end mt-4">
                          <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                          >
                            Post Answer
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {!currentUser && (
                    <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                      <p className="text-gray-600 mb-4">Please login to post an answer</p>
                      <Link
                        to="/login"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Login to Answer
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Question Stats</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Asked</span>
                      <span className="font-medium">{formatTimeAgo(selectedQuestion.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Activity</span>
                      <span className="font-medium">{formatTimeAgo(selectedQuestion.updated_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views</span>
                      <span className="font-medium">127</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Ask a Question</h1>
                
                <form onSubmit={handleSubmitQuestion} className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      Question Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={newQuestion.title}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="What specific problem are you trying to solve?"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {newQuestion.title.length}/200 characters
                    </p>
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a category</option>
                      {mockCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                      Question Details <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="content"
                      value={newQuestion.content}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Provide detailed information about your question. Include context, what you've tried, and specific requirements..."
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {newQuestion.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                          <TagIcon className="w-3 h-3" />
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-blue-500 hover:text-blue-700"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add relevant tags (press Enter to add)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Add Tag
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Suggested: {mockTags.slice(0, 6).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Post Question
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CommunityQA;