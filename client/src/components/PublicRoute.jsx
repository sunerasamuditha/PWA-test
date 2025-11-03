import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * PublicRoute component for routes that should redirect authenticated users
 * Useful for login/register pages to prevent authenticated users from accessing them
 * @param {React.ReactNode} children - Components to render if not authenticated
 * @param {string} redirectTo - Route to redirect to if authenticated (default: '/dashboard')
 * @returns {React.Component} Public route component
 */
const PublicRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // User is not authenticated, render children (login/register forms)
  return <>{children}</>;
};

export default PublicRoute;