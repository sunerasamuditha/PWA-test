import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiService from '../services/api';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  // State management
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state on app load
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Check if user is authenticated by verifying stored token
   */
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('wecare_token');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Set token in axios headers
      apiService.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token with backend
      const response = await apiService.get('/auth/me');
      
      if (response.data.success) {
        setUser(response.data.data.user);
        setAccessToken(token);
        setIsAuthenticated(true);
      } else {
        // Token is invalid, clear it
        clearAuthState();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Token is invalid or expired, clear it
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user with email and password
   */
  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      
      const response = await apiService.post('/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        const { accessToken: newToken, user: userData } = response.data.data;
        
        // Store token in localStorage
        localStorage.setItem('wecare_token', newToken);
        
        // Set token in axios headers
        apiService.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Update state
        setAccessToken(newToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        return { success: true, user: userData };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      
      const errorMessage = error.message || 
                          error.data?.error?.message || 
                          'An error occurred during login';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      
      const response = await apiService.post('/auth/register', userData);

      if (response.data.success) {
        const { accessToken: newToken, user: newUser } = response.data.data;
        
        // Store token in localStorage
        localStorage.setItem('wecare_token', newToken);
        
        // Set token in axios headers
        apiService.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Update state
        setAccessToken(newToken);
        setUser(newUser);
        setIsAuthenticated(true);
        
        return { success: true, user: newUser };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Registration failed' 
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle validation errors
      if (error.data?.errors) {
        const validationErrors = error.data.errors
          .map(err => err.msg)
          .join(', ');
        return { success: false, error: validationErrors };
      }
      
      const errorMessage = error.message || 
                          error.data?.error?.message || 
                          'An error occurred during registration';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to clear server-side refresh token
      await apiService.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with client-side logout even if server call fails
    } finally {
      clearAuthState();
      
      // Redirect to login page
      window.location.href = '/login';
    }
  }, []);

  /**
   * Refresh access token using refresh token (handled by axios interceptor)
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await apiService.post('/auth/refresh');
      
      if (response.data.success) {
        const { accessToken: newToken } = response.data.data;
        
        // Update stored token
        localStorage.setItem('wecare_token', newToken);
        
        // Update axios headers
        apiService.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Update state
        setAccessToken(newToken);
        
        return newToken;
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // Refresh failed, logout user
      clearAuthState();
      window.location.href = '/login';
      
      throw error;
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updateData) => {
    try {
      const response = await apiService.put('/auth/profile', updateData);
      
      if (response.data.success) {
        const updatedUser = response.data.data.user;
        setUser(updatedUser);
        return { success: true, user: updatedUser };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Profile update failed' 
        };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      
      const errorMessage = error.message || 
                          error.data?.error?.message || 
                          'An error occurred while updating profile';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }, []);

  /**
   * Change password
   */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const response = await apiService.put('/auth/password', {
        currentPassword,
        newPassword,
        confirmPassword: newPassword
      });
      
      if (response.data.success) {
        return { success: true, message: 'Password changed successfully' };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Password change failed' 
        };
      }
    } catch (error) {
      console.error('Password change error:', error);
      
      const errorMessage = error.message || 
                          error.data?.error?.message || 
                          'An error occurred while changing password';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }, []);

  /**
   * Clear authentication state
   */
  const clearAuthState = useCallback(() => {
    localStorage.removeItem('wecare_token');
    delete apiService.defaults.headers.common['Authorization'];
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);
  }, []);

  // Context value
  const contextValue = {
    // State
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    
    // Actions
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    checkAuth
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;