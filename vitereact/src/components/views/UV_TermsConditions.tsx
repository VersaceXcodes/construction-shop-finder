import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Download, Calendar, Check, Clock, FileText, Shield, Cookie, Users, Scale } from 'lucide-react';

// Types and Interfaces

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

interface ConsentData {
  terms_accepted: boolean;
  terms_accepted_date: string | null;
  privacy_accepted: boolean;
  privacy_accepted_date: string | null;
  marketing_consent: boolean;
  cookie_preferences: Record<string, boolean>;
}

interface DocumentVersion {
  version: string;
  date: string;
  changes: string[];
}

const UV_TermsConditions: React.FC = () => {
  // Global state
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  // const language = useAppStore(state => state.app_preferences.language);

  // Local state
  const [activeTab, setActiveTab] = useState<string>('terms');
  const [consentData, setConsentData] = useState<ConsentData>({
    terms_accepted: false,
    terms_accepted_date: null,
    privacy_accepted: false,
    privacy_accepted_date: null,
    marketing_consent: false,
    cookie_preferences: {}
  });

  const queryClient = useQueryClient();

  const legalContent = {
    terms: {
      content: 'Terms of Service content',
      version: '2.1',
      effective_date: '2023-12-15',
      last_updated: '2023-12-15'
    },
    privacy: {
      content: 'Privacy Policy content',
      version: '2.1',
      effective_date: '2023-12-15',
      last_updated: '2023-12-15'
    },
    gdpr: {
      content: 'GDPR Policy content',
      version: '1.0',
      effective_date: '2023-12-15',
      last_updated: '2023-12-15'
    }
  };

  const cookieCategories: CookieCategory[] = [
    {
      id: 'essential',
      name: 'Essential Cookies',
      description: 'Required for basic platform functionality and security',
      required: true,
      enabled: true
    },
    {
      id: 'performance',
      name: 'Performance Cookies',
      description: 'Help us analyze and improve platform performance',
      required: false,
      enabled: true
    },
    {
      id: 'functional',
      name: 'Functional Cookies',
      description: 'Enable enhanced features and personalization',
      required: false,
      enabled: true
    },
    {
      id: 'marketing',
      name: 'Marketing Cookies',
      description: 'Used for targeted advertising and recommendations',
      required: false,
      enabled: false
    }
  ];

  const versionHistory: DocumentVersion[] = [
    {
      version: '2.1',
      date: '2023-12-15',
      changes: [
        'Updated dispute resolution procedures',
        'Enhanced data protection clauses',
        'Clarified shop owner responsibilities'
      ]
    },
    {
      version: '2.0',
      date: '2023-10-01',
      changes: [
        'Major update for GDPR compliance',
        'Added cookie policy section',
        'Updated liability limitations'
      ]
    },
    {
      version: '1.9',
      date: '2023-07-15',
      changes: [
        'Minor clarifications in terms',
        'Updated contact information',
        'Fixed formatting issues'
      ]
    }
  ];

  // Initialize consent data from user preferences
  useEffect(() => {
    if (currentUser?.preferences) {
      setConsentData({
        terms_accepted: currentUser.preferences.terms_accepted || false,
        terms_accepted_date: currentUser.preferences.terms_accepted_date || null,
        privacy_accepted: currentUser.preferences.privacy_accepted || false,
        privacy_accepted_date: currentUser.preferences.privacy_accepted_date || null,
        marketing_consent: currentUser.preferences.marketing_consent || false,
        cookie_preferences: currentUser.preferences.cookie_preferences || {}
      });
    }
  }, [currentUser]);

  // Mutation for updating user consent
  const updateConsentMutation = useMutation({
    mutationFn: async (newConsentData: Partial<ConsentData>) => {
      if (!currentUser || !authToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.id}`,
        {
          preferences: {
            ...currentUser.preferences,
            ...newConsentData,
            terms_accepted_date: newConsentData.terms_accepted ? new Date().toISOString() : currentUser.preferences?.terms_accepted_date,
            privacy_accepted_date: newConsentData.privacy_accepted ? new Date().toISOString() : currentUser.preferences?.privacy_accepted_date
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      
      // Update local consent state
      if (updatedUser.preferences) {
        setConsentData({
          terms_accepted: updatedUser.preferences.terms_accepted || false,
          terms_accepted_date: updatedUser.preferences.terms_accepted_date || null,
          privacy_accepted: updatedUser.preferences.privacy_accepted || false,
          privacy_accepted_date: updatedUser.preferences.privacy_accepted_date || null,
          marketing_consent: updatedUser.preferences.marketing_consent || false,
          cookie_preferences: updatedUser.preferences.cookie_preferences || {}
        });
      }
    }
  });

  const handleConsentAcceptance = (type: 'terms' | 'privacy' | 'marketing', accepted: boolean) => {
    if (!isAuthenticated) return;

    const updateData: Record<string, boolean> = {};
    updateData[`${type}_accepted`] = accepted;
    
    updateConsentMutation.mutate(updateData as Partial<ConsentData>);
  };

  const handleCookiePreference = (categoryId: string, enabled: boolean) => {
    if (!isAuthenticated) return;

    const newCookiePreferences = {
      ...consentData.cookie_preferences,
      [categoryId]: enabled
    };

    updateConsentMutation.mutate({
      cookie_preferences: newCookiePreferences
    });
  };

  const handleDownloadDocument = (documentType: string) => {
    const content = legalContent[documentType as keyof typeof legalContent]?.content || '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constructhub-${documentType}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'terms', name: 'Terms of Service', icon: Scale },
    { id: 'privacy', name: 'Privacy Policy', icon: Shield },
    { id: 'cookies', name: 'Cookie Policy', icon: Cookie },
    { id: 'community', name: 'Community Guidelines', icon: Users }
  ];

  const currentDocument = legalContent[activeTab as keyof typeof legalContent];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Legal Documentation</h1>
                  <p className="mt-2 text-gray-600">Terms, policies, and guidelines for ConstructHub platform</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-semibold text-gray-900">{currentDocument?.last_updated}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadDocument(activeTab)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Download size={18} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
                <nav className="space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Version Info */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Current Version</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <FileText size={14} className="text-gray-400" />
                      <span className="text-gray-600">v{currentDocument?.version}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-gray-600">{currentDocument?.effective_date}</span>
                    </div>
                  </div>
                </div>

                {/* Version History Link */}
                <div className="mt-6">
                  <button
                    onClick={() => setActiveTab('versions')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Clock size={14} />
                    <span>View Version History</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {activeTab === 'versions' ? (
                  /* Version History */
                  <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Version History</h2>
                    <div className="space-y-6">
                      {versionHistory.map((version, index) => (
                        <div key={version.version} className="border-l-4 border-blue-200 pl-6 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Version {version.version}
                              {index === 0 && (
                                <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                                  Current
                                </span>
                              )}
                            </h3>
                            <span className="text-sm text-gray-500">{version.date}</span>
                          </div>
                          <ul className="space-y-1">
                            {version.changes.map((change, changeIndex) => (
                              <li key={changeIndex} className="text-gray-600 flex items-start space-x-2">
                                <span className="text-blue-500 mt-1">•</span>
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeTab === 'cookies' ? (
                  /* Cookie Policy with Preferences */
                  <div className="p-8">
                    <div className="prose max-w-none">
                      <div 
                        className="space-y-6 leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: currentDocument?.content.replace(/\n/g, '<br>').replace(/^# /gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">').replace(/^## /gm, '<h2 class="text-xl font-semibold text-gray-900 mt-6 mb-3">').replace(/^### /gm, '<h3 class="text-lg font-medium text-gray-900 mt-4 mb-2">')
                        }}
                      />
                    </div>

                    {/* Cookie Preferences */}
                    {isAuthenticated && (
                      <div className="mt-12 pt-8 border-t border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-900 mb-6">Cookie Preferences</h3>
                        <div className="space-y-6">
                          {cookieCategories.map((category) => (
                            <div key={category.id} className="bg-gray-50 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                                  <p className="text-gray-600 text-sm">{category.description}</p>
                                  {category.required && (
                                    <span className="inline-block mt-2 bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <div className="ml-6">
                                  <button
                                    onClick={() => !category.required && handleCookiePreference(category.id, !category.enabled)}
                                    disabled={category.required || updateConsentMutation.isPending}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                      category.enabled
                                        ? 'bg-blue-600'
                                        : 'bg-gray-200'
                                    } ${
                                      category.required 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'cursor-pointer hover:bg-opacity-80'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        category.enabled ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Regular Document Content */
                  <div className="p-8">
                    <div className="prose max-w-none">
                      <div 
                        className="space-y-6 leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: currentDocument?.content.replace(/\n/g, '<br>').replace(/^# /gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">').replace(/^## /gm, '<h2 class="text-xl font-semibold text-gray-900 mt-6 mb-3">').replace(/^### /gm, '<h3 class="text-lg font-medium text-gray-900 mt-4 mb-2">')
                        }}
                      />
                    </div>

                    {/* Consent Section for Authenticated Users */}
                    {isAuthenticated && (activeTab === 'terms' || activeTab === 'privacy') && (
                      <div className="mt-12 pt-8 border-t border-gray-200">
                        <div className="bg-blue-50 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {activeTab === 'terms' ? 'Terms Acceptance' : 'Privacy Consent'}
                          </h3>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-gray-700 mb-2">
                                {activeTab === 'terms' 
                                  ? 'I have read and agree to the Terms of Service'
                                  : 'I have read and agree to the Privacy Policy'
                                }
                              </p>
                              {(activeTab === 'terms' ? consentData.terms_accepted_date : consentData.privacy_accepted_date) && (
                                <p className="text-sm text-gray-500">
                                  Accepted on: {new Date(
                                    activeTab === 'terms' 
                                      ? consentData.terms_accepted_date! 
                                      : consentData.privacy_accepted_date!
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <button
                                onClick={() => handleConsentAcceptance(activeTab as 'terms' | 'privacy', true)}
                                disabled={updateConsentMutation.isPending || (activeTab === 'terms' ? consentData.terms_accepted : consentData.privacy_accepted)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                                  activeTab === 'terms' ? consentData.terms_accepted : consentData.privacy_accepted
                                    ? 'bg-green-100 text-green-800 cursor-default'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                                }`}
                              >
                                <Check size={18} />
                                <span>
                                  {activeTab === 'terms' ? consentData.terms_accepted : consentData.privacy_accepted
                                    ? 'Accepted'
                                    : 'Accept'
                                  }
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                For questions about these terms or our policies, please contact our legal team.
              </p>
              <div className="flex justify-center space-x-6 text-sm">
                <Link to="/help" className="text-blue-600 hover:text-blue-700 font-medium">
                  Contact Support
                </Link>
                <span className="text-gray-300">|</span>
                <Link to="/about" className="text-blue-600 hover:text-blue-700 font-medium">
                  About ConstructHub
                </Link>
                <span className="text-gray-300">|</span>
                <a href="mailto:legal@constructhub.ae" className="text-blue-600 hover:text-blue-700 font-medium">
                  legal@constructhub.ae
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default UV_TermsConditions;