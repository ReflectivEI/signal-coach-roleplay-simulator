// @ts-nocheck
import React, { createContext, useState, useContext, useEffect } from 'react';
import { appParams } from '@/lib/app-params';

/**
 * @typedef {{ name: string, email: string, role: string } | null} AuthUser
 */

/** @type {React.Context<any>} */
const AuthContext = createContext(undefined);

/** @param {{ children: React.ReactNode }} props */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(/** @type {AuthUser} */ (null));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    // Use email from localStorage if present
    const email = localStorage.getItem('login_email') || 'demo@reflectiv-ai.com';
    setUser({ name: 'Demo User', email, role: 'admin' });
    setIsAuthenticated(true);
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
  };

  const checkUserAuth = async () => {
    // Local demo mode - no auth check needed
    setIsLoadingAuth(false);
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/Login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth,
      appParams,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
