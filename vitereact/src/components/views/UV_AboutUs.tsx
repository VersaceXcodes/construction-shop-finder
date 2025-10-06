import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Mail, Phone, MapPin, Users, Building, TrendingUp, Award, Heart, Globe, Shield, Zap, Target } from 'lucide-react';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  user_type: string;
}

interface ContactFormErrors {
  [key: string]: string;
}

interface CompanyStats {
  total_users: number;
  total_shops: number;
  total_projects: number;
  cost_savings_generated: number;
}

const UV_AboutUs: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Global state access (individual selectors to avoid infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const appLanguage = useAppStore(state => state.app_preferences.language);

  // Local state
  const [currentSection, setCurrentSection] = useState<string | null>(searchParams.get('section'));
  const [contentLanguage] = useState<string>(searchParams.get('lang') || appLanguage || 'en');
  const [contactFormData, setContactFormData] = useState<ContactFormData>({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    subject: '',
    message: '',
    user_type: currentUser?.user_type || 'buyer'
  });
  const [contactFormErrors, setContactFormErrors] = useState<ContactFormErrors>({});
  const [isContactFormSubmitted, setIsContactFormSubmitted] = useState(false);
  const [pageLoadedAt] = useState<number>(Date.now());

  // Track page view analytics
  const trackPageViewMutation = useMutation({
    mutationFn: async (eventData: any) => {
      if (!authToken) return; // Skip if not authenticated
      
      return axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/analytics/events`,
        {
          event_type: 'about_us_viewed',
          event_data: eventData,
          page_url: window.location.href
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onError: (error) => {
      console.warn('Failed to track page view:', error);
    }
  });

  // Load company statistics (mock data since endpoint doesn't exist)
  const { data: companyStats } = useQuery<CompanyStats>({
    queryKey: ['company-stats'],
    queryFn: async () => {
      // Mock data since endpoint doesn't exist
      return {
        total_users: 15420,
        total_shops: 3240,
        total_projects: 8750,
        cost_savings_generated: 45600000
      };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Contact form submission (mock since endpoint doesn't exist)
  const contactFormMutation = useMutation({
    mutationFn: async (_formData: ContactFormData) => {
      // Mock submission since endpoint doesn't exist
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        success: true,
        message: 'Thank you for your inquiry. We will respond within 24 hours.',
        inquiry_id: 'mock_' + Date.now()
      };
    },
    onSuccess: () => {
      setIsContactFormSubmitted(true);
      setContactFormData({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        subject: '',
        message: '',
        user_type: currentUser?.user_type || 'buyer'
      });
      setContactFormErrors({});
    },
    onError: () => {
      setContactFormErrors({ submit: 'Failed to submit inquiry. Please try again.' });
    }
  });

  // Track page view on mount and section changes
  useEffect(() => {
    trackPageViewMutation.mutate({
      section: currentSection,
      language: contentLanguage,
      timestamp: pageLoadedAt
    });
  }, [currentSection, contentLanguage]);

  // Update URL when section changes
  const navigateToSection = (section: string | null) => {
    setCurrentSection(section);
    const newParams = new URLSearchParams(searchParams);
    if (section) {
      newParams.set('section', section);
    } else {
      newParams.delete('section');
    }
    setSearchParams(newParams);
  };

  // Validate contact form
  const validateContactForm = (): boolean => {
    const errors: ContactFormErrors = {};
    
    if (!contactFormData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!contactFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactFormData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!contactFormData.subject.trim()) {
      errors.subject = 'Subject is required';
    }
    
    if (!contactFormData.message.trim()) {
      errors.message = 'Message is required';
    } else if (contactFormData.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters long';
    }

    setContactFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle contact form submission
  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormErrors({});
    
    if (validateContactForm()) {
      contactFormMutation.mutate(contactFormData);
    }
  };

  // Handle form field changes with error clearing
  const handleFormFieldChange = (field: keyof ContactFormData, value: string) => {
    setContactFormData(prev => ({ ...prev, [field]: value }));
    if (contactFormErrors[field]) {
      setContactFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      navigateToSection(sectionId);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Transforming Construction
            <span className="block text-blue-600">Procurement</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            ConstructHub is revolutionizing how construction professionals discover, compare, and procure building materials across the UAE.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => scrollToSection('company-story')}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Our Story
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              Get In Touch
            </button>
          </div>
        </div>
      </section>

      {/* Navigation Menu */}
      <nav className="bg-white shadow-lg sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center overflow-x-auto py-4">
            <div className="flex space-x-8 min-w-max">
              {[
                { id: 'company-story', label: 'Our Story' },
                { id: 'platform', label: 'Platform' },
                { id: 'team', label: 'Team' },
                { id: 'impact', label: 'Impact' },
                { id: 'values', label: 'Values' },
                { id: 'contact', label: 'Contact' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    currentSection === item.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Company Statistics */}
      {companyStats && (
        <section className="bg-blue-600 py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="text-white">
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {companyStats.total_users.toLocaleString()}+
                </div>
                <div className="text-blue-100 font-medium">Active Users</div>
              </div>
              <div className="text-white">
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {companyStats.total_shops.toLocaleString()}+
                </div>
                <div className="text-blue-100 font-medium">Partner Shops</div>
              </div>
              <div className="text-white">
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {companyStats.total_projects.toLocaleString()}+
                </div>
                <div className="text-blue-100 font-medium">Projects Completed</div>
              </div>
              <div className="text-white">
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {(companyStats.cost_savings_generated / 1000000).toFixed(1)}M AED
                </div>
                <div className="text-blue-100 font-medium">Cost Savings</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Company Story Section */}
      <section id="company-story" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Our Story</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Born from the challenges faced by construction professionals in the UAE market
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">The Problem We Solve</h3>
              <div className="space-y-4">
                <p className="text-gray-600 leading-relaxed">
                  Construction professionals waste countless hours calling suppliers, comparing prices manually, and managing complex procurement processes. Price transparency was limited, and finding the right materials at the best prices required extensive legwork.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Small contractors struggled to compete with larger firms who had established supplier relationships, while shop owners missed opportunities to reach new customers due to limited visibility.
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Solution</h3>
              <div className="space-y-4">
                <p className="text-gray-600 leading-relaxed">
                  ConstructHub democratizes construction procurement by creating a transparent, efficient marketplace where contractors can instantly compare prices, check availability, and connect with verified suppliers across the UAE.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Our platform empowers both buyers and sellers with powerful tools for project management, route optimization, and real-time communication, creating a more efficient construction ecosystem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Overview Section */}
      <section id="platform" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Platform Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Cutting-edge technology solutions designed for construction professionals
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Smart Search & Discovery</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-powered search with voice recognition, barcode scanning, and intelligent product recommendations based on your project needs.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Price Comparison & Optimization</h3>
              <p className="text-gray-600 leading-relaxed">
                Real-time price comparison across multiple suppliers with route optimization and bulk purchasing recommendations.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Building className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Project Management Tools</h3>
              <p className="text-gray-600 leading-relaxed">
                Comprehensive BOM builder, RFQ management, and collaborative project planning with real-time updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Our Leadership Team</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Industry veterans and technology experts committed to transforming construction
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">AH</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ahmed Hassan</h3>
              <p className="text-blue-600 font-medium mb-4">Founder & CEO</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                15+ years in construction industry. Former procurement manager at major UAE developers. Holds MBA from AUS.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">SK</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sarah Khan</h3>
              <p className="text-green-600 font-medium mb-4">CTO & Co-founder</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Tech industry veteran with expertise in marketplace platforms. Former senior engineer at major e-commerce companies.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">MR</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Mohammed Rahman</h3>
              <p className="text-purple-600 font-medium mb-4">Head of Business Development</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Deep connections in UAE construction ecosystem. Former supplier network manager with extensive industry relationships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Impact Section */}
      <section id="impact" className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Market Impact</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Driving efficiency and transparency in the UAE construction industry
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Success Stories</h3>
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-2">Al Mansoori Construction</h4>
                      <p className="text-gray-600 text-sm">
                        "Reduced procurement time by 60% and saved 15% on material costs using ConstructHub's optimization tools."
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-2">Dubai Building Supplies</h4>
                      <p className="text-gray-600 text-sm">
                        "Increased customer reach by 200% and improved inventory turnover through ConstructHub's platform."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Industry Recognition</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Award className="w-8 h-8 text-yellow-500" />
                  <span className="text-gray-700 font-medium">Best PropTech Innovation 2023 - Dubai Chamber</span>
                </div>
                <div className="flex items-center space-x-4">
                  <Award className="w-8 h-8 text-yellow-500" />
                  <span className="text-gray-700 font-medium">UAE Construction Excellence Award 2023</span>
                </div>
                <div className="flex items-center space-x-4">
                  <Award className="w-8 h-8 text-yellow-500" />
                  <span className="text-gray-700 font-medium">Top 10 Construction Startups - MEED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Values Section */}
      <section id="values" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Our Values</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Transparency</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Open pricing, verified suppliers, and honest communication in every interaction.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Innovation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Continuous improvement through technology and user feedback.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Heart className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Customer Success</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Your success is our success. We're committed to your project outcomes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Globe className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Sustainability</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Promoting efficient resource use and sustainable construction practices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Get In Touch</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Ready to transform your construction procurement? Let's talk.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Contact Information</h3>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Headquarters</h4>
                    <p className="text-gray-600">
                      Dubai Internet City<br />
                      Building 3, Floor 12<br />
                      Dubai, UAE
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Phone</h4>
                    <p className="text-gray-600">
                      +971 4 123 4567<br />
                      +971 50 123 4567 (WhatsApp)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Email</h4>
                    <p className="text-gray-600">
                      hello@constructhub.ae<br />
                      support@constructhub.ae
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <h4 className="font-bold text-gray-900 mb-4">Business Hours</h4>
                <div className="text-gray-600 space-y-1">
                  <p>Sunday - Thursday: 8:00 AM - 6:00 PM</p>
                  <p>Friday: 8:00 AM - 12:00 PM</p>
                  <p>Saturday: Closed</p>
                </div>
              </div>
            </div>
            
            {/* Contact Form */}
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Send us a message</h3>
              
              {isContactFormSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Message Sent!</h4>
                  <p className="text-gray-600">
                    Thank you for your inquiry. We will respond within 24 hours.
                  </p>
                  <button
                    onClick={() => setIsContactFormSubmitted(false)}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactFormSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={contactFormData.name}
                        onChange={(e) => handleFormFieldChange('name', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                          contactFormErrors.name 
                            ? 'border-red-300 focus:border-red-500' 
                            : 'border-gray-200 focus:border-blue-500'
                        }`}
                        placeholder="Your full name"
                      />
                      {contactFormErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{contactFormErrors.name}</p>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={contactFormData.email}
                        onChange={(e) => handleFormFieldChange('email', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                          contactFormErrors.email 
                            ? 'border-red-300 focus:border-red-500' 
                            : 'border-gray-200 focus:border-blue-500'
                        }`}
                        placeholder="your.email@example.com"
                      />
                      {contactFormErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{contactFormErrors.email}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="user_type" className="block text-sm font-medium text-gray-700 mb-2">
                      I am a...
                    </label>
                    <select
                      id="user_type"
                      value={contactFormData.user_type}
                      onChange={(e) => handleFormFieldChange('user_type', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200"
                    >
                      <option value="buyer">Construction Professional / Contractor</option>
                      <option value="seller">Building Materials Supplier</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      value={contactFormData.subject}
                      onChange={(e) => handleFormFieldChange('subject', e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                        contactFormErrors.subject 
                          ? 'border-red-300 focus:border-red-500' 
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                      placeholder="How can we help you?"
                    />
                    {contactFormErrors.subject && (
                      <p className="mt-1 text-sm text-red-600">{contactFormErrors.subject}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={contactFormData.message}
                      onChange={(e) => handleFormFieldChange('message', e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 resize-none ${
                        contactFormErrors.message 
                          ? 'border-red-300 focus:border-red-500' 
                          : 'border-gray-200 focus:border-blue-500'
                      }`}
                      placeholder="Tell us about your project or inquiry..."
                    />
                    {contactFormErrors.message && (
                      <p className="mt-1 text-sm text-red-600">{contactFormErrors.message}</p>
                    )}
                  </div>
                  
                  {contactFormErrors.submit && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                      <p className="text-sm">{contactFormErrors.submit}</p>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={contactFormMutation.isPending}
                    className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {contactFormMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending Message...
                      </span>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-blue-600 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Join thousands of construction professionals who trust ConstructHub for their procurement needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Start Free Trial
            </Link>
            <Link
              to="/search"
              className="px-8 py-4 bg-transparent text-white rounded-lg font-semibold border-2 border-white hover:bg-white hover:text-blue-600 transition-all duration-200"
            >
              Explore Platform
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default UV_AboutUs;