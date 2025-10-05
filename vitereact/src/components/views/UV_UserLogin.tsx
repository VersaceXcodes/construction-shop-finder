import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle, Chrome } from 'lucide-react';

// API interfaces
interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

const UV_UserLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL parameters
  const redirectTo = searchParams.get('redirect_to');
  const resetToken = searchParams.get('reset_token');
  
  // Local state for forms
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    remember_me: false
  });
  
  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  
  const [forgotPasswordState, setForgotPasswordState] = useState({
    email: '',
    reset_sent: false,
    loading: false
  });
  
  const [socialAuthState, setSocialAuthState] = useState({
    google_loading: false,
    facebook_loading: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: '',
    confirmPassword: ''
  });
  
  // Zustand selectors (individual to avoid infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const loginUser = useAppStore(state => state.login_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const destination = redirectTo || (currentUser.user_type === 'seller' ? '/shop/dashboard' : '/search');
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, currentUser, redirectTo, navigate]);
  
  // Clear errors when inputs change
  useEffect(() => {
    if (authError) {
      clearAuthError();
    }
    setLoginErrors({});
  }, [loginForm.email, loginForm.password]);
  
  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordRequest) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/forgot-password`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      setForgotPasswordState(prev => ({
        ...prev,
        reset_sent: true,
        loading: false
      }));
    },
    onError: (error: any) => {
      setForgotPasswordState(prev => ({
        ...prev,
        loading: false
      }));
    }
  });
  
  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordRequest) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/reset-password`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      navigate('/login?reset=success', { replace: true });
    }
  });
  
  // Form validation
  const validateLoginForm = () => {
    const errors: typeof loginErrors = {};
    
    if (!loginForm.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(loginForm.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!loginForm.password) {
      errors.password = 'Password is required';
    } else if (loginForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle login form submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    
    if (!validateLoginForm()) return;
    
    try {
      await loginUser(loginForm.email, loginForm.password);
      // Navigation will be handled by useEffect when auth state updates
    } catch (error: any) {
      console.error('Login error:', error);
    }
  };
  
  // Handle forgot password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordState.email) {
      return;
    }
    
    setForgotPasswordState(prev => ({ ...prev, loading: true }));
    forgotPasswordMutation.mutate({ email: forgotPasswordState.email });
  };
  
  // Handle password reset submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetToken || !resetPasswordForm.password) return;
    
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      return;
    }
    
    if (resetPasswordForm.password.length < 6) {
      return;
    }
    
    resetPasswordMutation.mutate({
      token: resetToken,
      password: resetPasswordForm.password
    });
  };
  
  // Handle social login
  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    setSocialAuthState(prev => ({
      ...prev,
      [`${provider}_loading`]: true
    }));
    
    // Mock implementation - in production this would redirect to OAuth provider
    setTimeout(() => {
      setSocialAuthState(prev => ({
        ...prev,
        [`${provider}_loading`]: false
      }));
      console.log(`${provider} login would redirect to OAuth provider`);
    }, 1000);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">ConstructHub</h1>
            <h2 className="text-xl font-semibold text-gray-900">
              {resetToken ? 'Reset Your Password' : showForgotPassword ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {resetToken 
                ? 'Enter your new password below'
                : showForgotPassword 
                ? 'Enter your email to receive reset instructions'
                : 'Sign in to access your construction materials hub'
              }
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg shadow-gray-200/50 sm:rounded-xl sm:px-10 border border-gray-100">
            
            {/* Password Reset Form (when reset token exists) */}
            {resetToken && (
              <form className="space-y-6" onSubmit={handleResetPasswordSubmit}>
                {resetPasswordMutation.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">
                      {(resetPasswordMutation.error as any)?.response?.data?.message || 'Password reset failed. Please try again.'}
                    </p>
                  </div>
                )}
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={resetPasswordForm.password}
                      onChange={(e) => setResetPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                      className="block w-full px-4 py-3 pl-12 pr-12 border border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
                      placeholder="Enter new password"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={resetPasswordForm.confirmPassword}
                      onChange={(e) => setResetPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="block w-full px-4 py-3 pl-12 border border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
                      placeholder="Confirm new password"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  </div>
                  {resetPasswordForm.password && resetPasswordForm.confirmPassword && 
                   resetPasswordForm.password !== resetPasswordForm.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending || 
                           !resetPasswordForm.password || 
                           !resetPasswordForm.confirmPassword ||
                           resetPasswordForm.password !== resetPasswordForm.confirmPassword ||
                           resetPasswordForm.password.length < 6}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Forgot Password Form */}
            {!resetToken && showForgotPassword && (
              <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                {forgotPasswordState.reset_sent ? (
                  <div className="text-center space-y-4">
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm">
                        Password reset instructions have been sent to your email address.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotPasswordState({ email: '', reset_sent: false, loading: false });
                      }}
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    {forgotPasswordMutation.error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">
                          {(forgotPasswordMutation.error as any)?.response?.data?.message || 'Failed to send reset email. Please try again.'}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          id="resetEmail"
                          name="resetEmail"
                          type="email"
                          required
                          value={forgotPasswordState.email}
                          onChange={(e) => setForgotPasswordState(prev => ({ ...prev, email: e.target.value }))}
                          className="block w-full px-4 py-3 pl-12 border border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
                          placeholder="Enter your email address"
                        />
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-100 transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={forgotPasswordMutation.isPending || !forgotPasswordState.email}
                        className="flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {forgotPasswordMutation.isPending ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            Sending...
                          </>
                        ) : (
                          'Send Reset Email'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* Login Form */}
            {!resetToken && !showForgotPassword && (
              <>
                <form className="space-y-6" onSubmit={handleLoginSubmit}>
                  {(authError || loginErrors.general) && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm">{authError || loginErrors.general}</p>
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginForm.email}
                        onChange={(e) => {
                          setLoginForm(prev => ({ ...prev, email: e.target.value }));
                          if (loginErrors.email) {
                            setLoginErrors(prev => ({ ...prev, email: undefined }));
                          }
                        }}
                        className={`block w-full px-4 py-3 pl-12 border rounded-lg focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                          loginErrors.email 
                            ? 'border-red-300 focus:border-red-500' 
                            : 'border-gray-200 focus:border-blue-500'
                        }`}
                        placeholder="Enter your email"
                      />
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {loginErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{loginErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={loginForm.password}
                        onChange={(e) => {
                          setLoginForm(prev => ({ ...prev, password: e.target.value }));
                          if (loginErrors.password) {
                            setLoginErrors(prev => ({ ...prev, password: undefined }));
                          }
                        }}
                        className={`block w-full px-4 py-3 pl-12 pr-12 border rounded-lg focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                          loginErrors.password 
                            ? 'border-red-300 focus:border-red-500' 
                            : 'border-gray-200 focus:border-blue-500'
                        }`}
                        placeholder="Enter your password"
                      />
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{loginErrors.password}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={loginForm.remember_me}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, remember_me: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                        Remember me
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Social Login */}
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">Or continue with</span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('google')}
                      disabled={socialAuthState.google_loading}
                      className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {socialAuthState.google_loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Chrome className="h-5 w-5" />
                      )}
                      <span className="ml-2">Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSocialLogin('facebook')}
                      disabled={socialAuthState.facebook_loading}
                      className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {socialAuthState.facebook_loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="h-5 w-5 bg-blue-600 rounded"></div>
                      )}
                      <span className="ml-2">Facebook</span>
                    </button>
                  </div>
                </div>

                {/* Register Link */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link
                      to={`/register${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`}
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Create one now
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Guest Access */}
          {!resetToken && !showForgotPassword && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Want to explore first?</p>
              <Link
                to="/"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Continue as Guest
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Success message for password reset */}
        {searchParams.get('reset') === 'success' && (
          <div className="fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg shadow-lg flex items-center space-x-2 max-w-md">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              Password reset successful! You can now sign in with your new password.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_UserLogin;