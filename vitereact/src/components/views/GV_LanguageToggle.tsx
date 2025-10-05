import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/main';

const GV_LanguageToggle: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Individual selectors to avoid infinite loops
  const currentLanguage = useAppStore(state => state.app_preferences.language);
  const updateLanguage = useAppStore(state => state.update_language);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Available languages with RTL and display information
  const availableLanguages = [
    { 
      code: 'en', 
      label: 'English', 
      flag: '🇺🇸', 
      rtl: false,
      displayCode: 'EN'
    },
    { 
      code: 'ar', 
      label: 'العربية', 
      flag: '🇦🇪', 
      rtl: true,
      displayCode: 'ع'
    }
  ];

  const currentLangData = availableLanguages.find(lang => lang.code === currentLanguage) || availableLanguages[0];

  // Handle language change
  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage || isLoading) return;

    setIsLoading(true);
    setIsOpen(false);

    try {
      await updateLanguage(languageCode);
      
      // Update document lang attribute for accessibility
      document.documentElement.lang = languageCode;
      
      // Update document direction for RTL support
      const selectedLang = availableLanguages.find(lang => lang.code === languageCode);
      if (selectedLang) {
        document.documentElement.dir = selectedLang.rtl ? 'rtl' : 'ltr';
      }

      // Announce language change to screen readers
      const announcement = languageCode === 'ar' 
        ? 'تم تغيير اللغة إلى العربية'
        : 'Language changed to English';
      
      const ariaLiveElement = document.createElement('div');
      ariaLiveElement.setAttribute('aria-live', 'polite');
      ariaLiveElement.setAttribute('aria-atomic', 'true');
      ariaLiveElement.className = 'sr-only';
      ariaLiveElement.textContent = announcement;
      document.body.appendChild(ariaLiveElement);
      
      setTimeout(() => {
        document.body.removeChild(ariaLiveElement);
      }, 1000);

    } catch (error) {
      console.error('Failed to update language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        }
        break;
    }
  };

  // Handle option selection with keyboard
  const handleOptionKeyDown = (event: React.KeyboardEvent, languageCode: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleLanguageChange(languageCode);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className={`
              inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 
              hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
              ${isOpen ? 'ring-2 ring-blue-500 ring-offset-2 border-blue-500' : ''}
              ${currentLanguage === 'ar' ? 'flex-row-reverse' : ''}
            `}
            aria-expanded={isOpen}
            aria-haspopup={true}
            aria-label={`Current language: ${currentLangData.label}. Click to change language`}
            aria-describedby="language-toggle-description"
          >
            {isLoading ? (
              <svg 
                className="animate-spin h-4 w-4 text-gray-600" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <span className="flex items-center space-x-1">
                <span className="text-lg" aria-hidden="true">{currentLangData.flag}</span>
                <span className="text-xs font-bold" aria-hidden="true">{currentLangData.displayCode}</span>
              </span>
            )}
          </button>
        </div>

        <div 
          id="language-toggle-description" 
          className="sr-only"
        >
          Language selection toggle. Press Enter or Space to open options.
        </div>

        {isOpen && (
          <div 
            className={`
              absolute z-50 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
              ${currentLanguage === 'ar' ? 'right-0' : 'left-0'}
            `}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="language-menu"
          >
            <div className="py-1" role="none">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                {currentLanguage === 'ar' ? 'اختر اللغة' : 'Select Language'}
              </div>
              
              {availableLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  onKeyDown={(e) => handleOptionKeyDown(e, language.code)}
                  className={`
                    group flex w-full items-center px-3 py-2 text-sm transition-colors duration-150
                    ${currentLanguage === language.code 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                    ${language.rtl ? 'flex-row-reverse text-right' : 'text-left'}
                  `}
                  role="menuitem"
                  tabIndex={0}
                  aria-pressed={currentLanguage === language.code}
                >
                  <span 
                    className={`text-lg ${language.rtl ? 'ml-3' : 'mr-3'}`}
                    aria-hidden="true"
                  >
                    {language.flag}
                  </span>
                  
                  <div className="flex-1">
                    <div className={`font-medium ${language.rtl ? 'text-right' : 'text-left'}`}>
                      {language.label}
                    </div>
                    <div className={`text-xs text-gray-500 ${language.rtl ? 'text-right' : 'text-left'}`}>
                      {language.code.toUpperCase()}
                    </div>
                  </div>

                  {currentLanguage === language.code && (
                    <svg 
                      className={`h-4 w-4 text-blue-600 ${language.rtl ? 'mr-2' : 'ml-2'}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  )}
                </button>
              ))}

              {/* User status indicator */}
              <div className="px-3 py-2 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500">
                  <div className={`flex items-center ${currentLanguage === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <svg 
                      className={`h-3 w-3 ${currentLanguage === 'ar' ? 'ml-1' : 'mr-1'}`}
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <span>
                      {isAuthenticated 
                        ? (currentLanguage === 'ar' ? 'محفوظ في الحساب' : 'Saved to account')
                        : (currentLanguage === 'ar' ? 'محفوظ محلياً' : 'Saved locally')
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-optimized version for small screens */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className={`
            inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
            ${currentLanguage === 'ar' ? 'flex-row-reverse' : ''}
          `}
          aria-label={`Current language: ${currentLangData.label}`}
        >
          {isLoading ? (
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : (
            <span className="font-bold" aria-hidden="true">
              {currentLangData.displayCode}
            </span>
          )}
        </button>
      </div>
    </>
  );
};

export default GV_LanguageToggle;