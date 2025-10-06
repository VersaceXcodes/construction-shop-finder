import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { registrationSchema } from '@/lib/zodSchemas';
import { z } from 'zod';
import { 
  UserIcon, 
  BuildingStorefrontIcon, 
  EnvelopeIcon, 
  LockClosedIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const UV_UserRegistration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Global state access - individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const errorMessage = useAppStore(state => state.authentication_state.error_message);
  const registerUser = useAppStore(state => state.register_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // Form state management
  const [registrationForm, setRegistrationForm] = useState({
    email: '',
    password: '',
    name: '',
    user_type: (searchParams.get('account_type') as 'buyer' | 'seller') || 'buyer',
    phone: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    address: ''
  });

  const [formValidationErrors, setFormValidationErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    general?: string;
  }>({});

  const [registrationStep, setRegistrationStep] = useState({
    current_step: 1,
    total_steps: 4
  });

  const [accountTypeSelection, setAccountTypeSelection] = useState({
    selected_type: registrationForm.user_type,
    show_comparison: false
  });

  const [locationSetup, setLocationSetup] = useState({
    coordinates: null as { lat: number; lng: number } | null,
    address: '',
    manual_entry: false,
    location_loading: false,
    location_error: ''
  });

  const [verificationStatus, setVerificationStatus] = useState({
    email_sent: false,
    phone_sent: false,
    email_verified: false,
    phone_verified: false
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = searchParams.get('redirect_to') || '/search';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams]);

  // Clear auth errors when component mounts
  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  // Form validation using Zod
  const validateFormField = (field: string, value: any) => {
    try {
      const fieldSchema = registrationSchema.pick({ [field]: true });
      fieldSchema.parse({ [field]: value });
      
      setFormValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(err => err.path[0] === field);
        if (fieldError) {
          setFormValidationErrors(prev => ({
            ...prev,
            [field]: fieldError.message
          }));
        }
      }
    }
  };

  // Get user location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationSetup(prev => ({
        ...prev,
        location_error: 'Geolocation is not supported by this browser',
        manual_entry: true
      }));
      return;
    }

    setLocationSetup(prev => ({ ...prev, location_loading: true, location_error: '' }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationSetup(prev => ({
          ...prev,
          coordinates: { lat: latitude, lng: longitude },
          location_loading: false
        }));
        
        setRegistrationForm(prev => ({
          ...prev,
          location_lat: latitude,
          location_lng: longitude
        }));

        // Reverse geocoding would go here if we had a geocoding service
        setLocationSetup(prev => ({
          ...prev,
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        }));
      },
      (error) => {
        let errorMessage = 'Unable to retrieve location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. You can enter your address manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        setLocationSetup(prev => ({
          ...prev,
          location_loading: false,
          location_error: errorMessage,
          manual_entry: true
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Handle form submission
  const handleRegistration = async () => {
    clearAuthError();
    
    try {
      // Validate entire form
      registrationSchema.parse({
        email: registrationForm.email,
        password_hash: registrationForm.password,
        name: registrationForm.name,
        user_type: registrationForm.user_type,
        phone: registrationForm.phone || null,
        location_lat: registrationForm.location_lat,
        location_lng: registrationForm.location_lng,
        address: registrationForm.address || null
      });

      await registerUser({
        email: registrationForm.email,
        password: registrationForm.password,
        name: registrationForm.name,
        user_type: registrationForm.user_type,
        phone: registrationForm.phone || undefined,
        location_lat: registrationForm.location_lat || undefined,
        location_lng: registrationForm.location_lng || undefined,
        address: registrationForm.address || undefined
      });

      // Registration successful, redirect will happen via useEffect
    } catch (error: any) {
      console.error('Registration error:', error);
    }
  };

  // Navigation functions
  const nextStep = () => {
    if (registrationStep.current_step < registrationStep.total_steps) {
      setRegistrationStep(prev => ({
        ...prev,
        current_step: prev.current_step + 1
      }));
    }
  };

  const prevStep = () => {
    if (registrationStep.current_step > 1) {
      setRegistrationStep(prev => ({
        ...prev,
        current_step: prev.current_step - 1
      }));
    }
  };

  // Step validation
  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return accountTypeSelection.selected_type !== '';
      case 2:
        return registrationForm.email && 
               registrationForm.password && 
               registrationForm.name &&
               !formValidationErrors.email &&
               !formValidationErrors.password &&
               !formValidationErrors.name;
      case 3:
        return true; // Location is optional
      case 4:
        return true; // Verification happens after registration
      default:
        return false;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Join ConstructHub
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Connect with suppliers and streamline your construction material procurement
            </p>
          </div>

          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Step {registrationStep.current_step} of {registrationStep.total_steps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((registrationStep.current_step / registrationStep.total_steps) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(registrationStep.current_step / registrationStep.total_steps) * 100}%` }}
              />
            </div>
          </div>

          {/* Main registration card */}
          <div className="bg-white shadow-xl shadow-gray-200/50 rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-6 lg:p-8">
              {/* Error message */}
              {errorMessage && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start space-x-3">
                  <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              )}

              {/* Step 1: Account Type Selection */}
              {registrationStep.current_step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Choose Your Account Type
                    </h2>
                    <p className="text-gray-600">
                      Select the option that best describes your needs
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Buyer Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountTypeSelection({ selected_type: 'buyer', show_comparison: false });
                        setRegistrationForm(prev => ({ ...prev, user_type: 'buyer' }));
                      }}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg ${
                        accountTypeSelection.selected_type === 'buyer'
                          ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-lg ${
                          accountTypeSelection.selected_type === 'buyer' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <UserIcon className={`w-6 h-6 ${
                            accountTypeSelection.selected_type === 'buyer' ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Buyer / Contractor
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Find materials, compare prices, and manage projects
                          </p>
                          <ul className="text-xs text-gray-500 space-y-1">
                            <li>• Search and compare products</li>
                            <li>• Create Bills of Materials</li>
                            <li>• Request quotes from suppliers</li>
                            <li>• Track project costs</li>
                          </ul>
                        </div>
                      </div>
                    </button>

                    {/* Seller Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountTypeSelection({ selected_type: 'seller', show_comparison: false });
                        setRegistrationForm(prev => ({ ...prev, user_type: 'seller' }));
                      }}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg ${
                        accountTypeSelection.selected_type === 'seller'
                          ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-lg ${
                          accountTypeSelection.selected_type === 'seller' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <BuildingStorefrontIcon className={`w-6 h-6 ${
                            accountTypeSelection.selected_type === 'seller' ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Shop Owner / Supplier
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            List your products and connect with buyers
                          </p>
                          <ul className="text-xs text-gray-500 space-y-1">
                            <li>• Manage inventory and pricing</li>
                            <li>• Respond to quote requests</li>
                            <li>• Analytics and insights</li>
                            <li>• Customer management</li>
                          </ul>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Basic Information */}
              {registrationStep.current_step === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Basic Information
                    </h2>
                    <p className="text-gray-600">
                      Tell us about yourself
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <input
                          id="name"
                          type="text"
                          required
                          value={registrationForm.name}
                          onChange={(e) => {
                            setRegistrationForm(prev => ({ ...prev, name: e.target.value }));
                            setFormValidationErrors(prev => ({ ...prev, name: undefined }));
                            validateFormField('name', e.target.value);
                          }}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            formValidationErrors.name
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="Enter your full name"
                        />
                      </div>
                      {formValidationErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{formValidationErrors.name}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <div className="relative">
                        <EnvelopeIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <input
                          id="email"
                          type="email"
                          required
                          value={registrationForm.email}
                          onChange={(e) => {
                            setRegistrationForm(prev => ({ ...prev, email: e.target.value }));
                            setFormValidationErrors(prev => ({ ...prev, email: undefined }));
                            validateFormField('email', e.target.value);
                          }}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            formValidationErrors.email
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="Enter your email address"
                        />
                      </div>
                      {formValidationErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{formValidationErrors.email}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <LockClosedIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <input
                          id="password"
                          type="password"
                          required
                          value={registrationForm.password}
                          onChange={(e) => {
                            setRegistrationForm(prev => ({ ...prev, password: e.target.value }));
                            setFormValidationErrors(prev => ({ ...prev, password: undefined }));
                            validateFormField('password_hash', e.target.value);
                          }}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            formValidationErrors.password
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="Create a secure password"
                        />
                      </div>
                      {formValidationErrors.password && (
                        <p className="mt-1 text-sm text-red-600">{formValidationErrors.password}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 6 characters required
                      </p>
                    </div>

                    {/* Phone (optional for buyers, required for sellers) */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number {registrationForm.user_type === 'seller' ? '*' : '(Optional)'}
                      </label>
                      <div className="relative">
                        <PhoneIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <input
                          id="phone"
                          type="tel"
                          required={registrationForm.user_type === 'seller'}
                          value={registrationForm.phone}
                          onChange={(e) => {
                            setRegistrationForm(prev => ({ ...prev, phone: e.target.value }));
                            setFormValidationErrors(prev => ({ ...prev, phone: undefined }));
                            if (e.target.value) {
                              validateFormField('phone', e.target.value);
                            }
                          }}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 ${
                            formValidationErrors.phone
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="+971 50 123 4567"
                        />
                      </div>
                      {formValidationErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{formValidationErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Location Setup */}
              {registrationStep.current_step === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Location Setup
                    </h2>
                    <p className="text-gray-600">
                      Help us find suppliers near you (optional)
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Location detection */}
                    {!locationSetup.manual_entry && !locationSetup.coordinates && (
                      <div className="text-center p-6 bg-gray-50 rounded-lg">
                        <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Detect Your Location
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Allow location access to find nearby suppliers and get accurate delivery estimates
                        </p>
                        <button
                          type="button"
                          onClick={getUserLocation}
                          disabled={locationSetup.location_loading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          {locationSetup.location_loading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Detecting Location...
                            </>
                          ) : (
                            <>
                              <GlobeAltIcon className="w-4 h-4 mr-2" />
                              Use My Location
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationSetup(prev => ({ ...prev, manual_entry: true }))}
                          className="block mx-auto mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
                        >
                          Enter address manually instead
                        </button>
                      </div>
                    )}

                    {/* Location error */}
                    {locationSetup.location_error && (
                      <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
                        <p className="text-sm">{locationSetup.location_error}</p>
                      </div>
                    )}

                    {/* Location detected success */}
                    {locationSetup.coordinates && (
                      <div className="bg-green-50 border-2 border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center space-x-3">
                        <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Location detected successfully!</p>
                          <p className="text-xs text-green-600">
                            {locationSetup.address || `${locationSetup.coordinates.lat.toFixed(4)}, ${locationSetup.coordinates.lng.toFixed(4)}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Manual address entry */}
                    {(locationSetup.manual_entry || locationSetup.coordinates) && (
                      <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                          Address (Optional)
                        </label>
                        <div className="relative">
                          <MapPinIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <input
                            id="address"
                            type="text"
                            value={registrationForm.address}
                            onChange={(e) => {
                              setRegistrationForm(prev => ({ ...prev, address: e.target.value }));
                            }}
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:outline-none transition-all duration-200"
                            placeholder="Enter your address"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          This helps us show you nearby suppliers and calculate delivery costs
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Review & Submit */}
              {registrationStep.current_step === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Review & Complete
                    </h2>
                    <p className="text-gray-600">
                      Confirm your information and create your account
                    </p>
                  </div>

                  {/* Review information */}
                  <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Account Type:</span>
                      <span className="text-sm text-gray-900 capitalize flex items-center">
                        {registrationForm.user_type === 'buyer' ? (
                          <UserIcon className="w-4 h-4 mr-1" />
                        ) : (
                          <BuildingStorefrontIcon className="w-4 h-4 mr-1" />
                        )}
                        {registrationForm.user_type === 'buyer' ? 'Buyer / Contractor' : 'Shop Owner / Supplier'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Name:</span>
                      <span className="text-sm text-gray-900">{registrationForm.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Email:</span>
                      <span className="text-sm text-gray-900">{registrationForm.email}</span>
                    </div>
                    {registrationForm.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Phone:</span>
                        <span className="text-sm text-gray-900">{registrationForm.phone}</span>
                      </div>
                    )}
                    {registrationForm.address && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Address:</span>
                        <span className="text-sm text-gray-900">{registrationForm.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Terms and conditions */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      By creating an account, you agree to our{' '}
                      <Link to="/terms" className="text-blue-600 hover:text-blue-700 underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
                {/* Back button */}
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={registrationStep.current_step === 1}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <ChevronLeftIcon className="w-4 h-4 mr-1" />
                  Back
                </button>

                {/* Next/Submit button */}
                {registrationStep.current_step < registrationStep.total_steps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceedFromStep(registrationStep.current_step)}
                    className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Continue
                    <ChevronRightIcon className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegistration}
                    disabled={isLoading || !canProceedFromStep(registrationStep.current_step)}
                    className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                )}
              </div>

              {/* Login link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link 
                    to="/login" 
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_UserRegistration;