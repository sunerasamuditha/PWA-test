import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProtectedRoute component for protecting routes that require authentication
 * @param {React.ReactNode} children - Components to render if authorized
 * @param {string[]} allowedRoles - Array of roles that can access this route (optional)
 * @param {string[]} requiredPermissions - Array of permissions required for staff (optional)
 * @returns {React.Component} Protected route component
 */
const ProtectedRoute = ({ children, allowedRoles = null, requiredPermissions = null }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Verifying authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check role-based authorization if roles are specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      return (
        <Navigate 
          to="/unauthorized" 
          state={{ 
            requiredRoles: allowedRoles,
            userRole: user?.role,
            attemptedRoute: location.pathname
          }} 
          replace 
        />
      );
    }
  }

  // Check permission-based authorization for staff
  if (requiredPermissions && requiredPermissions.length > 0) {
    // Admins have all permissions
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    
    if (!isAdmin) {
      // For staff, check if they have the required permissions
      const userPermissions = user?.permissions || [];
      const hasRequiredPermission = requiredPermissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasRequiredPermission) {
        return (
          <Navigate 
            to="/unauthorized" 
            state={{ 
              requiredPermissions: requiredPermissions,
              userPermissions: userPermissions,
              attemptedRoute: location.pathname
            }} 
            replace 
          />
        );
      }
    }
  }

  // User is authenticated and authorized, render children
  return <>{children}</>;
};

export default ProtectedRoute;