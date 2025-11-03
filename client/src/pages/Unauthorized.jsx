import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Get the attempted URL from state or default to current path
  const attemptedUrl = location.state?.from?.pathname || location.pathname;
  
  // Determine the reason for unauthorized access
  const getUnauthorizedReason = () => {
    if (!user) {
      return {
        title: 'Authentication Required',
        message: 'You need to be logged in to access this page.',
        action: 'Please log in to continue.',
        suggestion: 'login'
      };
    }
    
    return {
      title: 'Access Denied',
      message: 'You do not have permission to access this page.',
      action: 'Your current role does not allow access to this resource.',
      suggestion: 'dashboard'
    };
  };

  // Get role-specific suggestions
  const getRoleSuggestions = () => {
    if (!user) return [];

    const suggestions = {
      patient: [
        { title: 'Patient Dashboard', path: '/dashboard', icon: '👤' },
        { title: 'Book Appointment', path: '/appointments/book', icon: '📅' },
        { title: 'Medical Records', path: '/medical-records', icon: '📋' },
        { title: 'Find Partners', path: '/partners', icon: '👥' }
      ],
      partner: [
        { title: 'Partner Dashboard', path: '/dashboard', icon: '👤' },
        { title: 'Available Requests', path: '/requests', icon: '📋' },
        { title: 'My Schedule', path: '/schedule', icon: '📅' },
        { title: 'Patient List', path: '/patients', icon: '👥' }
      ],
      staff: [
        { title: 'Staff Dashboard', path: '/dashboard', icon: '👤' },
        { title: 'User Management', path: '/admin/users', icon: '👥' },
        { title: 'Reports', path: '/admin/reports', icon: '📊' },
        { title: 'Settings', path: '/admin/settings', icon: '⚙️' }
      ],
      admin: [
        { title: 'Admin Dashboard', path: '/dashboard', icon: '👤' },
        { title: 'User Management', path: '/admin/users', icon: '👥' },
        { title: 'System Reports', path: '/admin/reports', icon: '📊' },
        { title: 'Settings', path: '/admin/settings', icon: '⚙️' }
      ],
      super_admin: [
        { title: 'Super Admin Dashboard', path: '/dashboard', icon: '👤' },
        { title: 'System Management', path: '/admin/system', icon: '🔧' },
        { title: 'User Management', path: '/admin/users', icon: '👥' },
        { title: 'Analytics', path: '/admin/analytics', icon: '📈' }
      ]
    };

    return suggestions[user.role] || suggestions.patient;
  };

  const unauthorizedInfo = getUnauthorizedReason();
  const roleSuggestions = getRoleSuggestions();

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        {/* Error Icon */}
        <div className="error-icon">
          {!user ? '🔒' : '⛔'}
        </div>

        {/* Error Information */}
        <div className="error-info">
          <h1 className="error-title">{unauthorizedInfo.title}</h1>
          <p className="error-message">{unauthorizedInfo.message}</p>
          <p className="error-action">{unauthorizedInfo.action}</p>
          
          {attemptedUrl !== '/' && (
            <div className="attempted-url">
              <small>Attempted to access: <code>{attemptedUrl}</code></small>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          {!user ? (
            <>
              <Link to="/login" className="primary-button">
                🔑 Log In
              </Link>
              <Link to="/register" className="secondary-button">
                👤 Create Account
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="primary-button">
                🏠 Go to Dashboard
              </Link>
              <button 
                onClick={() => window.history.back()} 
                className="secondary-button"
              >
                ← Go Back
              </button>
            </>
          )}
        </div>

        {/* User Information */}
        {user && (
          <div className="user-info-section">
            <h3>Current User Information</h3>
            <div className="user-details">
              <div className="user-detail">
                <span className="label">Name:</span>
                <span className="value">{user.fullName}</span>
              </div>
              <div className="user-detail">
                <span className="label">Role:</span>
                <span className="value role-badge">{user.role}</span>
              </div>
              <div className="user-detail">
                <span className="label">Email:</span>
                <span className="value">{user.email}</span>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Pages */}
        {roleSuggestions.length > 0 && (
          <div className="suggestions-section">
            <h3>Pages you can access:</h3>
            <div className="suggestions-grid">
              {roleSuggestions.map((suggestion, index) => (
                <Link 
                  key={index}
                  to={suggestion.path} 
                  className="suggestion-item"
                >
                  <span className="suggestion-icon">{suggestion.icon}</span>
                  <span className="suggestion-title">{suggestion.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="help-section">
          <h3>Need Help?</h3>
          <div className="help-options">
            <Link to="/support" className="help-link">
              💬 Contact Support
            </Link>
            <Link to="/faq" className="help-link">
              ❓ View FAQ
            </Link>
            <Link to="/privacy" className="help-link">
              🛡️ Privacy Policy
            </Link>
          </div>
        </div>

        {/* Additional Information */}
        <div className="additional-info">
          <details>
            <summary>Why am I seeing this page?</summary>
            <div className="info-content">
              {!user ? (
                <p>
                  This page requires you to be logged in. WeCare uses role-based 
                  access control to ensure that users only access features and 
                  information appropriate to their account type.
                </p>
              ) : (
                <p>
                  This page is restricted to certain user roles. Your current role 
                  ({user.role}) does not have permission to access the requested 
                  resource. This helps maintain security and ensures users see 
                  content relevant to their needs.
                </p>
              )}
              
              <h4>User Roles in WeCare:</h4>
              <ul>
                <li><strong>Patient:</strong> Access to personal health records, appointment booking, and partner services</li>
                <li><strong>Partner:</strong> Access to patient requests, scheduling, and earning management</li>
                <li><strong>Staff:</strong> Access to administrative functions and user management</li>
                <li><strong>Admin:</strong> Full system access and management capabilities</li>
                <li><strong>Super Admin:</strong> Complete system control and configuration</li>
              </ul>
            </div>
          </details>
        </div>

        {/* Footer Links */}
        <div className="unauthorized-footer">
          <Link to="/" className="footer-link">
            🏠 Home
          </Link>
          <span className="separator">|</span>
          <Link to="/about" className="footer-link">
            ℹ️ About WeCare
          </Link>
          <span className="separator">|</span>
          <Link to="/contact" className="footer-link">
            📧 Contact
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;