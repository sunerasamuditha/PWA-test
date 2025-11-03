import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { formatCommissionPoints } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentReferrals, setRecentReferrals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load partner statistics and recent referrals in parallel
      const [statsResponse, referralsResponse] = await Promise.all([
        apiService.get('/partners/stats'),
        apiService.get('/partners/referrals?limit=5&page=1')
      ]);

      if (statsResponse.success) {
        setStats(statsResponse.data);
      } else {
        setError('Failed to load statistics');
      }

      if (referralsResponse.success) {
        setRecentReferrals(referralsResponse.data.referrals || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCommissionPoints = (points) => {
    return `${parseFloat(points || 0).toFixed(2)} pts`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { text: 'Active', className: 'status-active' },
      pending: { text: 'Pending', className: 'status-pending' },
      suspended: { text: 'Suspended', className: 'status-suspended' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`status-badge ${config.className}`}>
        {config.text}
      </span>
    );
  };

  const getReferralStatusBadge = (status) => {
    const statusConfig = {
      completed: { text: 'Completed', className: 'referral-completed' },
      pending: { text: 'Pending', className: 'referral-pending' },
      cancelled: { text: 'Cancelled', className: 'referral-cancelled' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`referral-status ${config.className}`}>
        {config.text}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading partner dashboard..." />;
  }

  return (
    <div className="partner-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="welcome-section">
            <h1>Welcome back, {user?.fullName}!</h1>
            <p className="welcome-subtitle">
              Here's your partner performance overview
            </p>
          </div>
          
          <div className="header-actions">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="refresh-button"
            >
              {refreshing ? (
                <>
                  <LoadingSpinner size="small" />
                  Refreshing...
                </>
              ) : (
                <>
                  <span className="refresh-icon">🔄</span>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage 
          message={error} 
          onClose={() => setError('')}
        />
      )}

      <div className="dashboard-content">
        {/* Partner Status Alert */}
        {user?.partner?.status !== 'active' && (
          <div className="status-alert">
            <div className="alert-icon">
              {user?.partner?.status === 'pending' ? '⏳' : '⚠️'}
            </div>
            <div className="alert-content">
              <h3>
                {user?.partner?.status === 'pending' ? 'Application Under Review' : 'Account Issue'}
              </h3>
              <p>
                {user?.partner?.status === 'pending'
                  ? 'Your partner application is being reviewed. You\'ll be notified once approved.'
                  : 'Your account needs attention. Please contact support.'
                }
              </p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="stats-section">
            <h2 className="section-title">Performance Overview</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-value">{formatCommissionPoints(stats.totalCommission)}</div>
                  <div className="stat-label">Total Commission Points</div>
                  <div className="stat-change">
                    Current Balance: {formatCommissionPoints(stats.commissionPoints)}
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalReferrals || 0}</div>
                  <div className="stat-label">Total Referrals</div>
                  <div className="stat-change">
                    All time referrals
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">{stats.status === 'active' ? '✅' : stats.status === 'pending' ? '⏳' : '⚠️'}</div>
                <div className="stat-content">
                  <div className="stat-value">{getStatusBadge(stats.status)}</div>
                  <div className="stat-label">Partner Status</div>
                  <div className="stat-change">
                    {stats.isActive ? 'Earning commissions' : 'Cannot earn commissions'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="dashboard-grid">
          {/* Recent Referrals */}
          <div className="recent-referrals-section">
            <div className="section-header">
              <h2 className="section-title">Recent Referrals</h2>
              <Link to="/partner/referrals" className="view-all-link">
                View All →
              </Link>
            </div>

            {recentReferrals.length > 0 ? (
              <div className="referrals-list">
                {recentReferrals.map((referral) => (
                  <div key={referral.id} className="referral-item">
                    <div className="referral-info">
                      <div className="referral-patient">
                        <strong>{referral.patientName || 'New Patient'}</strong>
                        <span className="referral-email">{referral.patientEmail}</span>
                      </div>
                      <div className="referral-details">
                        <span className="referral-date">{formatDate(referral.referredAt)}</span>
                        <span className="referral-commission">
                          {formatCommissionPoints(referral.commissionAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Referrals Yet</h3>
                <p>Start sharing your referral code to earn commission points!</p>
                <Link to="/partner/profile" className="get-started-button">
                  Get Referral Code
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-section">
            <h2 className="section-title">Quick Actions</h2>
            
            <div className="action-cards">
              <Link to="/partner/profile" className="action-card">
                <div className="action-icon">👤</div>
                <div className="action-content">
                  <h3>View Profile</h3>
                  <p>Update your partner information and settings</p>
                </div>
                <div className="action-arrow">→</div>
              </Link>

              <Link to="/partner/profile#qr-code" className="action-card">
                <div className="action-icon">📱</div>
                <div className="action-content">
                  <h3>Get QR Code</h3>
                  <p>Generate your unique referral QR code</p>
                </div>
                <div className="action-arrow">→</div>
              </Link>

              <Link to="/partner/referrals" className="action-card">
                <div className="action-icon">📊</div>
                <div className="action-content">
                  <h3>View Referrals</h3>
                  <p>Track all your referrals and earnings</p>
                </div>
                <div className="action-arrow">→</div>
              </Link>

              <Link to="/partner/commission-history" className="action-card">
                <div className="action-icon">💳</div>
                <div className="action-content">
                  <h3>Commission History</h3>
                  <p>View detailed commission reports</p>
                </div>
                <div className="action-arrow">→</div>
              </Link>
            </div>
          </div>
        </div>

        {/* Tips and Guidelines */}
        <div className="tips-section">
          <h2 className="section-title">Partner Tips</h2>
          
          <div className="tips-grid">
            <div className="tip-card">
              <div className="tip-icon">💡</div>
              <div className="tip-content">
                <h3>Share Your QR Code</h3>
                <p>Display your QR code at your business location for easy patient registration.</p>
              </div>
            </div>

            <div className="tip-card">
              <div className="tip-icon">🤝</div>
              <div className="tip-content">
                <h3>Build Relationships</h3>
                <p>Maintain good relationships with referred patients for better retention.</p>
              </div>
            </div>

            <div className="tip-card">
              <div className="tip-icon">📈</div>
              <div className="tip-content">
                <h3>Track Performance</h3>
                <p>Monitor your referral metrics to optimize your partnership strategy.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="support-section">
          <div className="support-card">
            <div className="support-icon">💬</div>
            <div className="support-content">
              <h3>Need Help?</h3>
              <p>Our partner support team is here to assist you with any questions.</p>
            </div>
            <div className="support-actions">
              <button className="support-button">Contact Support</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;