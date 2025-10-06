import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Download, ChevronRight, Shield, Eye, Users, Lock, Scale, Globe } from 'lucide-react';
import { useAppStore } from '@/store/main';

interface AnalyticsEventPayload {
  event_type: string;
  event_data: Record<string, any>;
  page_url: string;
}

const UV_PrivacyPolicy: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // const navigate = useNavigate();
  
  // Global state access
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const globalLanguage = useAppStore(state => state.app_preferences.language);
  
  // State variables as defined in datamap
  const [currentSection, setCurrentSection] = useState<string | null>(
    searchParams.get('section') || null
  );
  const [contentLanguage, setContentLanguage] = useState<string>(
    searchParams.get('lang') || globalLanguage || 'en'
  );
  // const [pageLoadedAt] = useState<number>(Date.now());
  
  // Analytics tracking mutation
  const trackAnalyticsMutation = useMutation({
    mutationFn: async (payload: AnalyticsEventPayload) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/analytics/events`,
        {
          user_id: null,
          session_id: null,
          event_type: payload.event_type,
          event_data: payload.event_data,
          page_url: payload.page_url,
        },
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        }
      );
      return response.data;
    },
  });

  // Track page view on mount and section changes
  useEffect(() => {
    const trackPageView = () => {
      trackAnalyticsMutation.mutate({
        event_type: 'privacy_policy_viewed',
        event_data: {
          section: currentSection,
          language: contentLanguage,
          timestamp: Date.now(),
        },
        page_url: window.location.href,
      });
    };

    trackPageView();
  }, [currentSection, contentLanguage, trackAnalyticsMutation]);

  // Navigate to section and update URL
  const navigateToSection = (section: string | null) => {
    setCurrentSection(section);
    
    const newSearchParams = new URLSearchParams(searchParams);
    if (section) {
      newSearchParams.set('section', section);
    } else {
      newSearchParams.delete('section');
    }
    setSearchParams(newSearchParams);

    // Scroll to section if it exists
    if (section) {
      setTimeout(() => {
        const element = document.getElementById(section);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle language change
  const handleLanguageChange = (language: string) => {
    setContentLanguage(language);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('lang', language);
    setSearchParams(newSearchParams);
  };

  // Download policy (handle missing endpoint gracefully)
  const handleDownloadPolicy = () => {
    // Since the endpoint is missing, show a user-friendly message
    alert(contentLanguage === 'ar' 
      ? 'ميزة تحميل PDF قيد التطوير وستكون متاحة قريباً'
      : 'PDF download feature is under development and will be available soon');
  };

  const isRTL = contentLanguage === 'ar';

  // Privacy policy sections data
  const sections = [
    {
      id: 'data-collection',
      title: isRTL ? 'جمع البيانات' : 'Data Collection',
      icon: <Eye className="w-5 h-5" />,
    },
    {
      id: 'data-usage',
      title: isRTL ? 'استخدام البيانات' : 'Data Usage',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'user-rights',
      title: isRTL ? 'حقوق المستخدم' : 'User Rights',
      icon: <Scale className="w-5 h-5" />,
    },
    {
      id: 'security',
      title: isRTL ? 'الأمان' : 'Security',
      icon: <Lock className="w-5 h-5" />,
    },
  ];

  return (
    <>
      <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <Shield className="w-8 h-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                      {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                      {isRTL 
                        ? 'آخر تحديث: ديسمبر 2023' 
                        : 'Last updated: December 2023'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  {/* Language Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        contentLanguage === 'en'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => handleLanguageChange('ar')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        contentLanguage === 'ar'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      عربي
                    </button>
                  </div>
                  
                  {/* Download Button */}
                  <button
                    onClick={handleDownloadPolicy}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
                    {isRTL ? 'تحميل PDF' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Table of Contents */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {isRTL ? 'المحتويات' : 'Contents'}
                </h2>
                <nav className="space-y-2">
                  <button
                    onClick={() => navigateToSection(null)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      !currentSection
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {isRTL ? 'نظرة عامة' : 'Overview'}
                  </button>
                  
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => navigateToSection(section.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentSection === section.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {section.icon}
                      <span className="ml-3 rtl:ml-0 rtl:mr-3">{section.title}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 lg:p-8">
                  {/* Overview Section */}
                  {!currentSection && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          {isRTL ? 'نظرة عامة على الخصوصية' : 'Privacy Overview'}
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                          {isRTL 
                            ? 'في ConstructHub، نلتزم بحماية خصوصيتك وبياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحمايتنا ومشاركتنا لمعلوماتك عند استخدام منصتنا لمواد البناء والمشتريات.'
                            : 'At ConstructHub, we are committed to protecting your privacy and personal data. This privacy policy explains how we collect, use, protect, and share your information when you use our construction materials and procurement platform.'
                          }
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() => navigateToSection(section.id)}
                            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                          >
                            <div className="flex items-center mb-2">
                              {section.icon}
                              <h3 className="ml-3 rtl:ml-0 rtl:mr-3 font-semibold text-gray-900">
                                {section.title}
                              </h3>
                              <ChevronRight className={`w-4 h-4 text-gray-400 ml-auto rtl:ml-0 rtl:mr-auto ${isRTL ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Collection Section */}
                  {currentSection === 'data-collection' && (
                    <div id="data-collection" className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          {isRTL ? 'جمع البيانات' : 'Data Collection'}
                        </h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                          {isRTL 
                            ? 'نجمع أنواعاً مختلفة من المعلومات لتقديم وتحسين خدماتنا:'
                            : 'We collect various types of information to provide and improve our services:'
                          }
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="font-semibold text-blue-900 mb-2">
                            {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                          </h3>
                          <ul className="text-blue-800 text-sm space-y-1">
                            <li>• {isRTL ? 'الاسم وعنوان البريد الإلكتروني' : 'Name and email address'}</li>
                            <li>• {isRTL ? 'رقم الهاتف والعنوان' : 'Phone number and address'}</li>
                            <li>• {isRTL ? 'معلومات الشركة (للشركات)' : 'Company information (for businesses)'}</li>
                            <li>• {isRTL ? 'تفضيلات الموقع' : 'Location preferences'}</li>
                          </ul>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h3 className="font-semibold text-green-900 mb-2">
                            {isRTL ? 'البيانات التلقائية' : 'Automatic Data Collection'}
                          </h3>
                          <ul className="text-green-800 text-sm space-y-1">
                            <li>• {isRTL ? 'ملفات تعريف الارتباط وتقنيات التتبع' : 'Cookies and tracking technologies'}</li>
                            <li>• {isRTL ? 'معلومات الجهاز والمتصفح' : 'Device and browser information'}</li>
                            <li>• {isRTL ? 'عناوين IP وبيانات الاستخدام' : 'IP addresses and usage data'}</li>
                            <li>• {isRTL ? 'معلومات الموقع الجغرافي' : 'Geographic location information'}</li>
                          </ul>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <h3 className="font-semibold text-purple-900 mb-2">
                            {isRTL ? 'المعلومات المقدمة من المستخدم' : 'User-Provided Information'}
                          </h3>
                          <ul className="text-purple-800 text-sm space-y-1">
                            <li>• {isRTL ? 'قوائم المواد (BOM) والمشاريع' : 'Bill of Materials (BOM) and projects'}</li>
                            <li>• {isRTL ? 'طلبات عروض الأسعار والرسائل' : 'RFQ requests and messages'}</li>
                            <li>• {isRTL ? 'المراجعات والتقييمات' : 'Reviews and ratings'}</li>
                            <li>• {isRTL ? 'تفضيلات البحث والتنبيهات' : 'Search preferences and alerts'}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data Usage Section */}
                  {currentSection === 'data-usage' && (
                    <div id="data-usage" className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          {isRTL ? 'استخدام البيانات' : 'Data Usage'}
                        </h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                          {isRTL 
                            ? 'نستخدم المعلومات التي نجمعها للأغراض التالية:'
                            : 'We use the information we collect for the following purposes:'
                          }
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'تقديم الخدمات ووظائف المنصة' : 'Service Provision & Platform Functionality'}
                          </h3>
                          <p className="text-gray-700 text-sm">
                            {isRTL 
                              ? 'توفير ميزات البحث والمقارنة، وإدارة BOMs، وتسهيل الاتصال بين المشترين والبائعين.'
                              : 'Providing search and comparison features, managing BOMs, and facilitating communication between buyers and sellers.'
                            }
                          </p>
                        </div>

                        <div className="border-l-4 border-green-500 bg-green-50 p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'التخصيص والتوصيات' : 'Personalization & Recommendations'}
                          </h3>
                          <p className="text-gray-700 text-sm">
                            {isRTL 
                              ? 'تخصيص نتائج البحث، وتقديم توصيات المنتجات، وتحسين تجربة المستخدم بناءً على التفضيلات.'
                              : 'Customizing search results, providing product recommendations, and improving user experience based on preferences.'
                            }
                          </p>
                        </div>

                        <div className="border-l-4 border-purple-500 bg-purple-50 p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'التسويق والاتصالات' : 'Marketing & Communications'}
                          </h3>
                          <p className="text-gray-700 text-sm">
                            {isRTL 
                              ? 'إرسال تنبيهات الأسعار، وتحديثات المخزون، والرسائل الإعلامية ذات الصلة (بموافقتك).'
                              : 'Sending price alerts, inventory updates, and relevant promotional messages (with your consent).'
                            }
                          </p>
                        </div>

                        <div className="border-l-4 border-red-500 bg-red-50 p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'الامتثال القانوني والسلامة' : 'Legal Compliance & Safety'}
                          </h3>
                          <p className="text-gray-700 text-sm">
                            {isRTL 
                              ? 'الامتثال للمتطلبات القانونية، ومنع الاحتيال، وضمان أمان المنصة والمستخدمين.'
                              : 'Complying with legal requirements, preventing fraud, and ensuring platform and user safety.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Rights Section */}
                  {currentSection === 'user-rights' && (
                    <div id="user-rights" className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          {isRTL ? 'حقوق المستخدم والتحكم' : 'User Rights & Controls'}
                        </h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                          {isRTL 
                            ? 'لديك حقوق مختلفة فيما يتعلق ببياناتك الشخصية وكيفية استخدامها:'
                            : 'You have various rights regarding your personal data and how it is used:'
                          }
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'الوصول والتصدير' : 'Access & Portability'}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3">
                            {isRTL 
                              ? 'طلب نسخة من بياناتك الشخصية وتصديرها بتنسيق قابل للقراءة.'
                              : 'Request a copy of your personal data and export it in a readable format.'
                            }
                          </p>
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            {isRTL ? 'طلب البيانات' : 'Request Data'}
                          </button>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'التصحيح والحذف' : 'Correction & Deletion'}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3">
                            {isRTL 
                              ? 'تحديث المعلومات غير الصحيحة أو حذف حسابك وبياناتك.'
                              : 'Update incorrect information or delete your account and data.'
                            }
                          </p>
                          <Link 
                            to="/profile" 
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            {isRTL ? 'إدارة الحساب' : 'Manage Account'}
                          </Link>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'تفضيلات الاتصال' : 'Communication Preferences'}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3">
                            {isRTL 
                              ? 'التحكم في أنواع الرسائل والتنبيهات التي تتلقاها.'
                              : 'Control the types of messages and alerts you receive.'
                            }
                          </p>
                          <Link 
                            to="/alerts" 
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            {isRTL ? 'إدارة التنبيهات' : 'Manage Alerts'}
                          </Link>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {isRTL ? 'إعدادات الخصوصية' : 'Privacy Settings'}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3">
                            {isRTL 
                              ? 'تخصيص مستوى خصوصيتك ومشاركة البيانات.'
                              : 'Customize your privacy level and data sharing preferences.'
                            }
                          </p>
                          <Link 
                            to="/settings" 
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            {isRTL ? 'إعدادات الخصوصية' : 'Privacy Settings'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security Section */}
                  {currentSection === 'security' && (
                    <div id="security" className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                          {isRTL ? 'الأمان والحماية' : 'Security & Protection'}
                        </h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                          {isRTL 
                            ? 'نطبق تدابير أمنية شاملة لحماية بياناتك:'
                            : 'We implement comprehensive security measures to protect your data:'
                          }
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                          <div className="flex items-center mb-3">
                            <Shield className="w-6 h-6 text-green-600 mr-3 rtl:mr-0 rtl:ml-3" />
                            <h3 className="font-semibold text-green-900">
                              {isRTL ? 'تقنيات حماية البيانات' : 'Data Protection Technologies'}
                            </h3>
                          </div>
                          <ul className="text-green-800 text-sm space-y-1">
                            <li>• {isRTL ? 'تشفير SSL/TLS للبيانات المنقولة' : 'SSL/TLS encryption for data in transit'}</li>
                            <li>• {isRTL ? 'تشفير AES-256 للبيانات المخزنة' : 'AES-256 encryption for data at rest'}</li>
                            <li>• {isRTL ? 'التوقيع الرقمي والتحقق من السلامة' : 'Digital signatures and integrity verification'}</li>
                          </ul>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                          <div className="flex items-center mb-3">
                            <Lock className="w-6 h-6 text-blue-600 mr-3 rtl:mr-0 rtl:ml-3" />
                            <h3 className="font-semibold text-blue-900">
                              {isRTL ? 'إجراءات التحكم في الوصول' : 'Access Control Procedures'}
                            </h3>
                          </div>
                          <ul className="text-blue-800 text-sm space-y-1">
                            <li>• {isRTL ? 'المصادقة متعددة العوامل' : 'Multi-factor authentication'}</li>
                            <li>• {isRTL ? 'التحكم في الوصول القائم على الأدوار' : 'Role-based access control'}</li>
                            <li>• {isRTL ? 'مراجعة الوصول والتدقيق المنتظم' : 'Regular access reviews and auditing'}</li>
                          </ul>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                          <div className="flex items-center mb-3">
                            <Globe className="w-6 h-6 text-purple-600 mr-3 rtl:mr-0 rtl:ml-3" />
                            <h3 className="font-semibold text-purple-900">
                              {isRTL ? 'حماية النقل الدولي' : 'International Transfer Safeguards'}
                            </h3>
                          </div>
                          <ul className="text-purple-800 text-sm space-y-1">
                            <li>• {isRTL ? 'امتثال اللائحة العامة لحماية البيانات' : 'GDPR compliance measures'}</li>
                            <li>• {isRTL ? 'البنود التعاقدية النموذجية' : 'Standard contractual clauses'}</li>
                            <li>• {isRTL ? 'شهادات نقل البيانات الآمنة' : 'Secure data transfer certifications'}</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <h3 className="font-semibold text-red-900 mb-3">
                          {isRTL ? 'الإبلاغ عن الحوادث الأمنية' : 'Security Incident Reporting'}
                        </h3>
                        <p className="text-red-800 text-sm mb-3">
                          {isRTL 
                            ? 'إذا كنت تشك في حدوث خرق أمني أو انتهاك للخصوصية، يرجى الاتصال بفريق الأمان لدينا فوراً:'
                            : 'If you suspect a security breach or privacy violation, please contact our security team immediately:'
                          }
                        </p>
                        <a 
                          href="mailto:security@constructhub.com"
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                          security@constructhub.com
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {isRTL ? 'تواصل معنا' : 'Contact Us'}
                    </h3>
                    <p className="text-gray-700 text-sm mb-4">
                      {isRTL 
                        ? 'إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه أو ممارسات البيانات لدينا:'
                        : 'If you have any questions about this privacy policy or our data practices:'
                      }
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900 mb-1">
                          {isRTL ? 'البريد الإلكتروني' : 'Email'}
                        </p>
                        <a 
                          href="mailto:privacy@constructhub.com"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          privacy@constructhub.com
                        </a>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 mb-1">
                          {isRTL ? 'مسؤول حماية البيانات' : 'Data Protection Officer'}
                        </p>
                        <a 
                          href="mailto:dpo@constructhub.com"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          dpo@constructhub.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PrivacyPolicy;