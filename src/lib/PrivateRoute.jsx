import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

// Only allow access if authenticated and user email matches admin
const ADMIN_EMAIL = 'legal@reflectiv-ai.com';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null; // Optionally show spinner

  if (!isAuthenticated || !user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
