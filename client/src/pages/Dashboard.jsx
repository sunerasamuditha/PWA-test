import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPolicyNumber, formatPassportNumber, isExpiringWithinMonths, isShiftActive, getLiveDuration, formatShiftDuration, getShiftTypeDisplayName, getShiftTypeBadgeColor } from '../utils/validation';
import { apiService } from '../services/api';

const Dashboard = () => {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // State management
  const [dashboardStats, setDashboardStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [documentStats, setDocumentStats] = useState(null);
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [healthSummaryLoading, setHealthSummaryLoading] = useState(false);
  const [healthSummaryError, setHealthSummaryError] = useState(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftStats, setShiftStats] = useState(null);
  const [liveDuration, setLiveDuration] = useState(0);
  const [auditStats, setAuditStats] = useState(null);
  const [auditStatsLoading, setAuditStatsLoading] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Fetch patient health summary data
  const fetchHealthSummary = async () => {
    if (user?.role !== 'patient') return;
    
    setHealthSummaryLoading(true);
    setHealthSummaryError(null);
    
    try {
      // Fetch patient profile using apiService
      const profileResponse = await apiService.patients.getPatientInfo();
      if (profileResponse.success) {
        setPatientProfile(profileResponse.data);
      }
      
      // Fetch recent health history using apiService
      const historyResponse = await apiService.patients.getHealthHistory({ limit: 5 });
      if (historyResponse.success) {
        setHealthHistory(historyResponse.data.healthHistory || []);
      }

      // Fetch upcoming appointments
      await fetchUpcomingAppointments();
      
      // Fetch document statistics using apiService
      const docStatsResponse = await apiService.documents.getDocumentStats();
      if (docStatsResponse.success) {
        setDocumentStats(docStatsResponse.data);
      }

      // Fetch invoice statistics using patient-specific endpoint
      const invoiceStatsResponse = await apiService.invoices.getMyInvoiceStats();
      if (invoiceStatsResponse.success) {
        setInvoiceStats(invoiceStatsResponse.data.stats);
      }
      
    } catch (error) {
      console.error('Error fetching health summary:', error);
      setHealthSummaryError(error.message || 'Failed to load health summary');
    } finally {
      setHealthSummaryLoading(false);
    }
  };

  // Fetch upcoming appointments for patient
  const fetchUpcomingAppointments = async () => {
    if (user?.role !== 'patient') return;

    try {
      setAppointmentsLoading(true);
      const today = new Date().toISOString();
      const response = await apiService.appointments.getAppointments({
        patient_user_id: user.id,
        status: 'scheduled',
        startDate: today,
        limit: 5
      });

      if (response.success) {
        setUpcomingAppointments(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Fetch admin dashboard statistics
  const fetchAdminStats = async () => {
    if (!['admin', 'super_admin'].includes(user?.role)) return;
    
    setAdminStatsLoading(true);
    setAdminStatsError(null);
    
    try {
      const response = await apiService.admin.getDashboardStats();
      if (response.success) {
        setAdminStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      setAdminStatsError('Failed to load dashboard statistics');
    } finally {
      setAdminStatsLoading(false);
    }
  };

  // Fetch audit statistics for admins
  const fetchAuditStats = async () => {
    if (!['admin', 'super_admin'].includes(user?.role)) return;
    
    setAuditStatsLoading(true);
    
    try {
      const response = await apiService.auditLogs.getStatistics();
      if (response.success) {
        setAuditStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    } finally {
      setAuditStatsLoading(false);
    }
  };

  // Load role-specific data when user changes
  useEffect(() => {
    if (user?.role === 'patient') {
      fetchHealthSummary();
    } else if (['admin', 'super_admin'].includes(user?.role)) {
      fetchAdminStats();
      fetchAuditStats();
    } else if (user?.role === 'staff') {
      fetchStaffShiftData();
    }
  }, [user]);

  // Update live duration every minute for active shifts
  useEffect(() => {
    if (activeShift) {
      const interval = setInterval(() => {
        setLiveDuration(getLiveDuration(activeShift.loginAt));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [activeShift]);

  // Fetch staff shift data
  const fetchStaffShiftData = async () => {
    if (user?.role !== 'staff') return;
    
    try {
      // Fetch active shift
      const activeShiftResponse = await apiService.shifts.getMyActiveShift();
      if (activeShiftResponse.success && activeShiftResponse.data.shift) {
        setActiveShift(activeShiftResponse.data.shift);
        setLiveDuration(getLiveDuration(activeShiftResponse.data.shift.loginAt));
      }

      // Fetch shift stats for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const statsResponse = await apiService.shifts.getMyShiftStats({
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      });
      if (statsResponse.success) {
        setShiftStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching shift data:', error);
    }
  };

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleMap = {
      patient: 'Patient',
      partner: 'Partner (Guide/Driver)',
      staff: 'Staff Member',
      admin: 'Administrator',
      super_admin: 'Super Administrator'
    };
    return roleMap[role] || role;
  };

  // Get dashboard greeting
  const getDashboardGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get role-specific dashboard content
  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'patient':
        return {
          title: 'Patient Dashboard',
          description: 'Manage your health journey with WeCare',
          quickActions: [
            { title: 'Book Appointment', icon: '📅', path: '/appointments/book' },
            { title: 'View Medical Records', icon: '📋', path: '/patient/health-history' },
            { title: 'My Documents', icon: '📄', path: '/patient/documents' },
            { title: 'Billing & Payments', icon: '💰', path: '/patient/payments' },
            { title: 'My Profile', icon: '👤', path: '/patient/profile' },
            { title: 'Emergency Contacts', icon: '🚨', path: '/emergency' }
          ]
        };
      case 'partner':
        return {
          title: 'Partner Dashboard',
          description: 'Help patients with their healthcare needs',
          quickActions: [
            { title: 'Available Requests', icon: '📋', path: '/requests' },
            { title: 'My Schedule', icon: '📅', path: '/schedule' },
            { title: 'Patient List', icon: '👤', path: '/patients' },
            { title: 'Earnings', icon: '💰', path: '/earnings' }
          ]
        };
      case 'staff':
      case 'admin':
      case 'super_admin':
        return {
          title: 'Admin Dashboard',
          description: 'Manage the WeCare platform',
          quickActions: [
            { title: 'Manage Appointments', icon: '📅', path: '/appointments' },
            { title: 'Patient Management', icon: '👥', path: '/admin/patients' },
            { title: 'Create Invoice', icon: '🧾', path: '/invoices/create' },
            { title: 'Manage Services', icon: '⚕️', path: '/admin/services' },
            { title: 'Partner Management', icon: '🤝', path: '/admin/partners' },
            { title: 'Staff Management', icon: '👨‍�', path: '/admin/staff' },
            { title: 'System Analytics', icon: '�', path: '/admin/analytics' },
            { title: 'User Management', icon: '�', path: '/admin/users' }
          ]
        };
      default:
        return {
          title: 'Dashboard',
          description: 'Welcome to WeCare',
          quickActions: []
        };
    }
  };

  // Render staff shift information
  const renderStaffShiftInfo = () => {
    if (user?.role !== 'staff') return null;

    return (
      <>
        {/* Active Shift Banner */}
        {activeShift && (
          <div className="active-shift-banner">
            <div className="shift-status-indicator">
              <div className="pulse-dot"></div>
              <span className="status-text">Currently On Shift</span>
            </div>
            <div className="active-shift-details">
              <div className="shift-info">
                <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(activeShift.shiftType) }}>
                  {getShiftTypeDisplayName(activeShift.shiftType)}
                </span>
                <span className="login-time">Started: {new Date(activeShift.loginAt).toLocaleTimeString()}</span>
              </div>
              <div className="live-duration">
                <span className="duration-label">Duration:</span>
                <span className="duration-value">{formatShiftDuration(liveDuration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Shift Statistics Card */}
        {shiftStats && (
          <div className="dashboard-card shift-stats-card">
            <div className="card-header">
              <h3>⏰ My Shift Summary (This Month)</h3>
              <Link to="/staff/shifts" className="view-all-link">
                View All Shifts →
              </Link>
            </div>
            
            <div className="card-content">
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{shiftStats.totalShifts || 0}</div>
                  <div className="stat-label">Total Shifts</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{shiftStats.totalHours?.toFixed(1) || '0'}</div>
                  <div className="stat-label">Total Hours</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{shiftStats.avgHoursPerShift?.toFixed(1) || '0'}</div>
                  <div className="stat-label">Avg Hours/Shift</div>
                </div>
              </div>
              
              {shiftStats.hoursByShiftType && Object.keys(shiftStats.hoursByShiftType).length > 0 && (
                <div className="shift-type-breakdown">
                  <h4>Hours by Shift Type</h4>
                  {Object.entries(shiftStats.hoursByShiftType).map(([type, data]) => (
                    <div key={type} className="shift-type-bar">
                      <div className="bar-label">
                        <span className="type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(type) }}>
                          {getShiftTypeDisplayName(type)}
                        </span>
                        <span className="hours">{data.hours.toFixed(1)} hrs</span>
                      </div>
                      <div className="bar-container">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(data.hours / shiftStats.totalHours) * 100}%`,
                            backgroundColor: getShiftTypeBadgeColor(type)
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  // Render admin statistics section
  const renderAdminStats = () => {
    if (!['admin', 'super_admin'].includes(user?.role)) return null;

    return (
      <div className="dashboard-card admin-stats-card">
        <div className="card-header">
          <h3>📊 System Statistics</h3>
          <button 
            onClick={fetchAdminStats}
            className="refresh-button"
            disabled={adminStatsLoading}
          >
            {adminStatsLoading ? '🔄' : '↻'} Refresh
          </button>
        </div>
        
        <div className="card-content">
          {adminStatsLoading ? (
            <div className="loading-state">
              <LoadingSpinner size="small" />
              <span>Loading statistics...</span>
            </div>
          ) : adminStatsError ? (
            <div className="error-state">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{adminStatsError}</span>
              <button 
                onClick={fetchAdminStats}
                className="retry-button"
              >
                Try Again
              </button>
            </div>
          ) : adminStats ? (
            <div className="admin-stats-content">
              {/* User Statistics */}
              <div className="stats-section">
                <h4>👥 Users</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.users?.total_users || 0}</div>
                    <div className="stat-label">Total Users</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.users?.total_patients || 0}</div>
                    <div className="stat-label">Patients</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.users?.total_partners || 0}</div>
                    <div className="stat-label">Partners</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.users?.total_staff || 0}</div>
                    <div className="stat-label">Staff</div>
                  </div>
                </div>
              </div>

              {/* Appointment Statistics */}
              <div className="stats-section">
                <h4>📅 Appointments</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.appointments?.total_appointments || 0}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.appointments?.appointments_today || 0}</div>
                    <div className="stat-label">Today</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.appointments?.scheduled_appointments || 0}</div>
                    <div className="stat-label">Scheduled</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.appointments?.completed_appointments || 0}</div>
                    <div className="stat-label">Completed</div>
                  </div>
                </div>
              </div>

              {/* Revenue Statistics */}
              <div className="stats-section">
                <h4>💰 Revenue</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">${adminStats.payments?.total_revenue?.toFixed(2) || '0.00'}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">${adminStats.payments?.revenue_today?.toFixed(2) || '0.00'}</div>
                    <div className="stat-label">Today</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">${adminStats.payments?.revenue_month?.toFixed(2) || '0.00'}</div>
                    <div className="stat-label">This Month</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.payments?.completed_payments || 0}</div>
                    <div className="stat-label">Paid Invoices</div>
                  </div>
                </div>
              </div>

              {/* Invoice Statistics */}
              <div className="stats-section">
                <h4>🧾 Invoices</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.invoices?.totalInvoices || 0}</div>
                    <div className="stat-label">Total Invoices</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.invoices?.pendingCount || 0}</div>
                    <div className="stat-label">Pending</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.invoices?.overdueCount || 0}</div>
                    <div className="stat-label">Overdue</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0
                      }).format(adminStats.invoices?.totalBilled || 0)}
                    </div>
                    <div className="stat-label">Total Billed</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0
                      }).format(adminStats.invoices?.totalOutstanding || 0)}
                    </div>
                    <div className="stat-label">Outstanding</div>
                  </div>
                </div>
              </div>

              {/* Partner Statistics */}
              <div className="stats-section">
                <h4>🤝 Partners</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.partners?.active_partners || 0}</div>
                    <div className="stat-label">Active</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.partners?.total_referrals || 0}</div>
                    <div className="stat-label">Referrals</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{adminStats.partners?.successful_referrals || 0}</div>
                    <div className="stat-label">Successful</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">${adminStats.partners?.total_commission_earned?.toFixed(2) || '0.00'}</div>
                    <div className="stat-label">Commission</div>
                  </div>
                </div>
              </div>

              {/* Shift Statistics */}
              {adminStats.shifts && (
                <div className="stats-section">
                  <h4>⏰ Staff Shifts</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.shifts.currentlyOnShift || 0}</div>
                      <div className="stat-label">Currently On Shift</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.shifts.shiftsToday || 0}</div>
                      <div className="stat-label">Shifts Today</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.shifts.totalHoursWeek?.toFixed(1) || '0'}</div>
                      <div className="stat-label">Hours This Week</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.shifts.totalHoursMonth?.toFixed(1) || '0'}</div>
                      <div className="stat-label">Hours This Month</div>
                    </div>
                  </div>
                  {adminStats.shifts.shiftsByType && Object.keys(adminStats.shifts.shiftsByType).length > 0 && (
                    <div className="shift-type-summary">
                      <h5>Hours by Shift Type (This Month)</h5>
                      {Object.entries(adminStats.shifts.shiftsByType).map(([type, data]) => (
                        <div key={type} className="shift-type-item">
                          <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(type) }}>
                            {getShiftTypeDisplayName(type)}
                          </span>
                          <span className="shift-hours">{data.total_hours?.toFixed(1) || '0'} hrs ({data.shift_count || 0} shifts)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* External Entities Statistics */}
              {adminStats.externalEntities && (
                <div className="stats-section">
                  <h4>🏢 External Entities</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.totalEntities || 0}</div>
                      <div className="stat-label">Total Entities</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.byType?.hospital || 0}</div>
                      <div className="stat-label">Hospitals</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.byType?.lab || 0}</div>
                      <div className="stat-label">Laboratories</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.byType?.supplier || 0}</div>
                      <div className="stat-label">Suppliers</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.byType?.insurance_company || 0}</div>
                      <div className="stat-label">Insurance Cos.</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{adminStats.externalEntities.newEntitiesMonth || 0}</div>
                      <div className="stat-label">New This Month</div>
                    </div>
                  </div>
                  <div className="view-all-link">
                    <Link to="/admin/external-entities">Manage Entities →</Link>
                  </div>
                </div>
              )}

              {/* Accounts Payable Statistics */}
              {adminStats.accountsPayable && (
                <>
                  {/* Alert Banners for Overdue and Due Soon */}
                  {adminStats.accountsPayable.overdueCount > 0 && (
                    <div className="alert-banner alert-danger">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          <strong>Overdue Payables:</strong> {adminStats.accountsPayable.overdueCount} payable{adminStats.accountsPayable.overdueCount !== 1 ? 's' : ''} totaling{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          }).format(adminStats.accountsPayable.overdueAmount || 0)} are overdue
                        </div>
                        <Link to="/admin/accounts-payable?status=overdue" className="btn btn-sm btn-outline-danger">
                          View Overdue
                        </Link>
                      </div>
                    </div>
                  )}

                  {adminStats.accountsPayable.dueSoonCount > 0 && (
                    <div className="alert-banner alert-warning">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <i className="bi bi-clock-fill me-2"></i>
                          <strong>Due Soon:</strong> {adminStats.accountsPayable.dueSoonCount} payable{adminStats.accountsPayable.dueSoonCount !== 1 ? 's' : ''} totaling{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          }).format(adminStats.accountsPayable.dueSoonAmount || 0)} due within 7 days
                        </div>
                        <Link to="/admin/accounts-payable" className="btn btn-sm btn-outline-warning">
                          View Due Soon
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="stats-section">
                    <h4>💳 Accounts Payable</h4>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <div className="stat-value">{adminStats.accountsPayable.totalPayables || 0}</div>
                        <div className="stat-label">Total Payables</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{adminStats.accountsPayable.dueCount || 0}</div>
                        <div className="stat-label">Due</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{adminStats.accountsPayable.paidCount || 0}</div>
                        <div className="stat-label">Paid</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{adminStats.accountsPayable.overdueCount || 0}</div>
                        <div className="stat-label">Overdue</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0
                          }).format(adminStats.accountsPayable.totalAmount || 0)}
                        </div>
                        <div className="stat-label">Total Amount</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0
                          }).format(adminStats.accountsPayable.dueAmount || 0)}
                        </div>
                        <div className="stat-label">Due Amount</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0
                          }).format(adminStats.accountsPayable.paidAmount || 0)}
                        </div>
                        <div className="stat-label">Paid Amount</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0
                          }).format(adminStats.accountsPayable.overdueAmount || 0)}
                        </div>
                        <div className="stat-label">Overdue Amount</div>
                      </div>
                    </div>
                    
                    {adminStats.accountsPayable.byEntityType && Object.keys(adminStats.accountsPayable.byEntityType).length > 0 && (
                      <div className="entity-payable-breakdown">
                        <h5>Payables by Entity Type</h5>
                        <div className="breakdown-list">
                          {Object.entries(adminStats.accountsPayable.byEntityType).map(([type, data]) => (
                            <div key={type} className="breakdown-item">
                              <span className="breakdown-label">{type.replace('_', ' ').toUpperCase()}</span>
                              <div className="breakdown-stats">
                                <span className="breakdown-count">{data.count || 0} payables</span>
                                <span className="breakdown-amount">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 0
                                  }).format(data.totalAmount || 0)}
                                </span>
                                {data.overdueAmount > 0 && (
                                  <span className="breakdown-overdue text-danger">
                                    (Overdue: {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      minimumFractionDigits: 0
                                    }).format(data.overdueAmount)})
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="view-all-link">
                      <Link to="/admin/accounts-payable">Manage Payables →</Link>
                    </div>
                  </div>
                </>
              )}

              {/* Recent Activity */}
              {adminStats.recentActivity && adminStats.recentActivity.length > 0 && (
                <div className="stats-section">
                  <h4>📈 Recent Activity</h4>
                  <div className="recent-activity-list">
                    {adminStats.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="activity-item-admin">
                        <div className="activity-type">{activity.type}</div>
                        <div className="activity-description">{activity.description}</div>
                        <div className="activity-time">
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <span className="empty-message">No statistics available</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render audit statistics section
  const renderAuditStats = () => {
    if (!['admin', 'super_admin'].includes(user?.role)) return null;

    return (
      <div className="dashboard-card audit-stats-card">
        <div className="card-header">
          <h3>🔍 Security Audit Trail</h3>
          <Link to="/admin/audit-logs" className="view-all-link">
            View All Logs →
          </Link>
        </div>
        
        <div className="card-content">
          {auditStatsLoading ? (
            <div className="loading-state">
              <LoadingSpinner size="small" />
              <span>Loading audit statistics...</span>
            </div>
          ) : auditStats ? (
            <div className="audit-stats-content">
              {/* Total Logs */}
              <div className="stats-section">
                <div className="total-logs">
                  <div className="stat-value">{auditStats.totalLogs || 0}</div>
                  <div className="stat-label">Total Audit Logs</div>
                </div>
              </div>

              {/* Actions Breakdown */}
              {auditStats.byAction && Object.keys(auditStats.byAction).length > 0 && (
                <div className="stats-section">
                  <h4>Actions</h4>
                  <div className="actions-breakdown">
                    {Object.entries(auditStats.byAction).map(([action, count]) => (
                      <div key={action} className="action-stat-item">
                        <span className="action-label">{action.replace('_', ' ').toUpperCase()}</span>
                        <span className="action-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Breakdown */}
              {auditStats.byEntity && Object.keys(auditStats.byEntity).length > 0 && (
                <div className="stats-section">
                  <h4>Most Audited Entities</h4>
                  <div className="entities-breakdown">
                    {Object.entries(auditStats.byEntity)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([entity, count]) => (
                        <div key={entity} className="entity-stat-item">
                          <span className="entity-label">{entity}</span>
                          <span className="entity-count">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {auditStats.recentLogs && auditStats.recentLogs.length > 0 && (
                <div className="stats-section">
                  <h4>Recent Activity</h4>
                  <div className="recent-audit-logs">
                    {auditStats.recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="audit-log-item">
                        <div className="log-action">
                          <span className={`action-badge action-${log.action.toLowerCase()}`}>
                            {log.action}
                          </span>
                        </div>
                        <div className="log-details">
                          <span className="log-entity">
                            {log.targetEntityType} #{log.targetEntityId}
                          </span>
                          <span className="log-user">by {log.userName || 'Unknown'}</span>
                        </div>
                        <div className="log-time">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <span className="empty-message">No audit statistics available</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render patient health summary section
  const renderPatientHealthSummary = () => {
    if (user?.role !== 'patient') return null;

    return (
      <div className="dashboard-card health-summary-card">
        <div className="card-header">
          <h3>🏥 Health Summary</h3>
          <button 
            onClick={fetchHealthSummary}
            className="refresh-button"
            disabled={healthSummaryLoading}
          >
            {healthSummaryLoading ? '🔄' : '↻'} Refresh
          </button>
        </div>
        
        <div className="card-content">
          {healthSummaryLoading ? (
            <div className="loading-state">
              <LoadingSpinner size="small" />
              <span>Loading health summary...</span>
            </div>
          ) : healthSummaryError ? (
            <div className="error-state">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{healthSummaryError}</span>
              <button 
                onClick={fetchHealthSummary}
                className="retry-button"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="health-summary-content">
              {/* Travel Documents Status */}
              {patientProfile && (
                <div className="health-section">
                  <h4>📋 Travel Documents</h4>
                  <div className="document-status">
                    {patientProfile.passportInfo ? (
                      <div className="document-item">
                        <div className="document-header">
                          <span className="document-icon">📘</span>
                          <span className="document-title">Passport</span>
                          {isExpiringWithinMonths(patientProfile.passportInfo.expiryDate) && (
                            <span className="expiry-warning">⚠️ Expiring Soon</span>
                          )}
                        </div>
                        <div className="document-details">
                          <span>Number: {formatPassportNumber(patientProfile.passportInfo.number)}</span>
                          <span>Expires: {new Date(patientProfile.passportInfo.expiryDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="document-missing">
                        <span className="missing-icon">❌</span>
                        <span>No passport information on file</span>
                        <Link to="/patient/profile" className="add-link">Add passport info</Link>
                      </div>
                    )}
                    
                    {patientProfile.insuranceInfo ? (
                      <div className="document-item">
                        <div className="document-header">
                          <span className="document-icon">🛡️</span>
                          <span className="document-title">Travel Insurance</span>
                          {isExpiringWithinMonths(patientProfile.insuranceInfo.expiryDate) && (
                            <span className="expiry-warning">⚠️ Expiring Soon</span>
                          )}
                        </div>
                        <div className="document-details">
                          <span>Policy: {formatPolicyNumber(patientProfile.insuranceInfo.policyNumber)}</span>
                          {patientProfile.insuranceInfo.expiryDate && (
                            <span>Expires: {new Date(patientProfile.insuranceInfo.expiryDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="document-missing">
                        <span className="missing-icon">❌</span>
                        <span>No insurance information on file</span>
                        <Link to="/patient/profile" className="add-link">Add insurance info</Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Appointments */}
              <div className="health-section">
                <h4>📅 Upcoming Appointments</h4>
                {appointmentsLoading ? (
                  <div className="loading-state">
                    <LoadingSpinner size="small" />
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="appointments-list">
                    {upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="appointment-item">
                        <div className="appointment-date">
                          {new Date(appointment.appointmentDatetime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="appointment-details">
                          <div className="appointment-time">
                            {new Date(appointment.appointmentDatetime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="appointment-type">
                            {appointment.appointmentType.toUpperCase()}
                          </div>
                          <span className="status-badge status-badge-scheduled">Scheduled</span>
                        </div>
                      </div>
                    ))}
                    <div className="view-all-link">
                      <Link to="/appointments">View All Appointments →</Link>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📅</span>
                    <span className="empty-message">No upcoming appointments</span>
                    <Link to="/appointments/book" className="add-link">
                      Book Your First Appointment
                    </Link>
                  </div>
                )}
              </div>

              {/* Recent Health Records */}
              <div className="health-section">
                <h4>📊 Recent Health Records</h4>
                {healthHistory.length > 0 ? (
                  <div className="health-timeline">
                    {healthHistory.map((event, index) => (
                      <div key={event.data?.id || index} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-type">{event.type || 'Health Record'}</span>
                            <span className="timeline-date">
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="timeline-description">
                            {event.data?.description || 
                             event.data?.notes || 
                             event.data?.appointmentType ||
                             'No description available'}
                          </div>
                          {event.data?.status && (
                            <div className={`severity-badge severity-${event.data.status.toLowerCase().replace(' ', '-')}`}>
                              {event.data.status}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="view-all-link">
                      <Link to="/patient/health-history">View All Records →</Link>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <span className="empty-message">No health records found</span>
                    <Link to="/patient/health-history" className="add-link">
                      Add your first health record
                    </Link>
                  </div>
                )}
              </div>

              {/* Health Alerts */}
              <div className="health-section">
                <h4>🚨 Health Alerts</h4>
                <div className="health-alerts">
                  {patientProfile?.passportInfo && isExpiringWithinMonths(patientProfile.passportInfo.expiryDate) && (
                    <div className="alert alert-warning">
                      <span className="alert-icon">⚠️</span>
                      <div className="alert-content">
                        <span className="alert-title">Passport Expiring Soon</span>
                        <span className="alert-message">
                          Your passport expires on {new Date(patientProfile.passportInfo.expiryDate).toLocaleDateString()}. 
                          Consider renewing before your next trip.
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {patientProfile?.insuranceInfo && isExpiringWithinMonths(patientProfile.insuranceInfo.expiryDate) && (
                    <div className="alert alert-warning">
                      <span className="alert-icon">⚠️</span>
                      <div className="alert-content">
                        <span className="alert-title">Insurance Expiring Soon</span>
                        <span className="alert-message">
                          Your travel insurance expires on {new Date(patientProfile.insuranceInfo.expiryDate).toLocaleDateString()}. 
                          Renew to ensure continuous coverage.
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {!patientProfile?.passportInfo && !patientProfile?.insuranceInfo && (
                    <div className="alert alert-info">
                      <span className="alert-icon">ℹ️</span>
                      <div className="alert-content">
                        <span className="alert-title">Complete Your Profile</span>
                        <span className="alert-message">
                          Add your passport and insurance information to get personalized health alerts.
                        </span>
                        <Link to="/patient/profile" className="alert-action">Complete Profile</Link>
                      </div>
                    </div>
                  )}
                  
                  {patientProfile && !healthHistory.length && (
                    <div className="alert alert-info">
                      <span className="alert-icon">📋</span>
                      <div className="alert-content">
                        <span className="alert-title">Start Your Health Journey</span>
                        <span className="alert-message">
                          Add your health history to get better insights and personalized care.
                        </span>
                        <Link to="/patient/health-history" className="alert-action">Add Health Record</Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  if (!user) {
    return <LoadingSpinner fullScreen message="Redirecting..." />;
  }

  const roleContent = getRoleSpecificContent();

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>WeCare</h1>
            <span className="header-subtitle">{roleContent.title}</span>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <span className="user-name">{user.fullName}</span>
              <button 
                onClick={handleLogout}
                className="logout-button"
                title="Logout"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <h2>{getDashboardGreeting()}, {user.fullName}!</h2>
          <p>{roleContent.description}</p>
        </section>

        {/* Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Staff Shift Information */}
          {renderStaffShiftInfo()}

          {/* Profile Card */}
          <div className="dashboard-card profile-card">
            <div className="card-header">
              <h3>👤 Profile Information</h3>
              <Link 
                to="/profile"
                className="edit-button"
              >
                ✏️ Edit Profile
              </Link>
            </div>
            
            <div className="card-content">
              <div className="profile-info">
                <div className="info-row">
                  <span className="label">Name:</span>
                  <span className="value">{user.fullName}</span>
                </div>
                <div className="info-row">
                  <span className="label">Email:</span>
                  <span className="value">{user.email}</span>
                </div>
                <div className="info-row">
                  <span className="label">Phone:</span>
                  <span className="value">{user.phoneNumber || 'Not provided'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Role:</span>
                  <span className="value role-badge">{getRoleDisplayName(user.role)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Member since:</span>
                  <span className="value">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Statistics Card for Admin/Staff */}
          {renderAdminStats()}

          {/* Audit Statistics Card for Admin */}
          {renderAuditStats()}

          {/* Health Summary Card for Patients */}
          {renderPatientHealthSummary()}

          {/* Document Stats Card for Patients */}
          {user?.role === 'patient' && (
            <div className="dashboard-card documents-stats-card">
              <div className="card-header">
                <h3>📄 My Documents</h3>
                <Link to="/patient/documents" className="view-all-link">
                  View All →
                </Link>
              </div>
              
              <div className="card-content">
                {healthSummaryLoading ? (
                  <div className="loading-state">
                    <LoadingSpinner size="small" />
                    <span>Loading documents...</span>
                  </div>
                ) : documentStats ? (
                  <div className="documents-stats-content">
                    <div className="total-documents">
                      <div className="stat-value">{documentStats.total || 0}</div>
                      <div className="stat-label">Total Documents</div>
                    </div>
                    
                    <div className="documents-by-type">
                      <h4>Documents by Type</h4>
                      <div className="type-list">
                        {documentStats.byType?.passport > 0 && (
                          <div className="type-item">
                            <span className="type-icon">🛂</span>
                            <span className="type-name">Passport</span>
                            <span className="type-count">{documentStats.byType.passport}</span>
                          </div>
                        )}
                        {documentStats.byType?.insurance_card > 0 && (
                          <div className="type-item">
                            <span className="type-icon">💳</span>
                            <span className="type-name">Insurance Card</span>
                            <span className="type-count">{documentStats.byType.insurance_card}</span>
                          </div>
                        )}
                        {documentStats.byType?.test_result > 0 && (
                          <div className="type-item">
                            <span className="type-icon">🧪</span>
                            <span className="type-name">Test Results</span>
                            <span className="type-count">{documentStats.byType.test_result}</span>
                          </div>
                        )}
                        {documentStats.byType?.lab_report > 0 && (
                          <div className="type-item">
                            <span className="type-icon">🔬</span>
                            <span className="type-name">Lab Reports</span>
                            <span className="type-count">{documentStats.byType.lab_report}</span>
                          </div>
                        )}
                        {documentStats.byType?.invoice > 0 && (
                          <div className="type-item">
                            <span className="type-icon">💰</span>
                            <span className="type-name">Invoices</span>
                            <span className="type-count">{documentStats.byType.invoice}</span>
                          </div>
                        )}
                        {documentStats.byType?.other > 0 && (
                          <div className="type-item">
                            <span className="type-icon">📎</span>
                            <span className="type-name">Other</span>
                            <span className="type-count">{documentStats.byType.other}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {documentStats.total === 0 && (
                      <div className="empty-state">
                        <span className="empty-icon">📄</span>
                        <span className="empty-message">No documents uploaded yet</span>
                        <Link to="/patient/documents" className="btn btn-primary">
                          Upload Documents
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📄</span>
                    <span className="empty-message">No document information available</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing Summary Card for Patients */}
          {user?.role === 'patient' && (
            <div className="dashboard-card billing-stats-card">
              <div className="card-header">
                <h3>💰 Billing Summary</h3>
                <Link to="/patient/payments" className="view-all-link">
                  View All →
                </Link>
              </div>
              
              <div className="card-content">
                {healthSummaryLoading ? (
                  <div className="loading-state">
                    <LoadingSpinner size="small" />
                    <span>Loading billing info...</span>
                  </div>
                ) : invoiceStats ? (
                  <div className="billing-stats-content">
                    <div className="stats-grid">
                      <div className="stat-box">
                        <div className="stat-value">{invoiceStats.totalInvoices || 0}</div>
                        <div className="stat-label">Total Invoices</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{invoiceStats.invoicesByStatus?.pending || 0}</div>
                        <div className="stat-label">Pending</div>
                      </div>
                      <div className="stat-box outstanding">
                        <div className="stat-value">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0
                          }).format(invoiceStats.outstandingBalance || 0)}
                        </div>
                        <div className="stat-label">Outstanding</div>
                      </div>
                    </div>
                    
                    {invoiceStats.totalInvoices === 0 && (
                      <div className="empty-state">
                        <span className="empty-icon">💰</span>
                        <span className="empty-message">No invoices yet</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">💰</span>
                    <span className="empty-message">No billing information available</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Card */}
          <div className="dashboard-card actions-card">
            <div className="card-header">
              <h3>🚀 Quick Actions</h3>
            </div>
            <div className="card-content">
              <div className="actions-grid">
                {roleContent.quickActions.map((action, index) => (
                  <Link 
                    key={index}
                    to={action.path}
                    className="action-item"
                  >
                    <span className="action-icon">{action.icon}</span>
                    <span className="action-title">{action.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Account Settings Card */}
          <div className="dashboard-card settings-card">
            <div className="card-header">
              <h3>⚙️ Account Settings</h3>
            </div>
            <div className="card-content">
              <div className="settings-menu">
                <Link to="/change-password" className="setting-item">
                  🔒 Change Password
                </Link>
                <Link to="/notifications" className="setting-item">
                  🔔 Notification Settings
                </Link>
                <Link to="/privacy" className="setting-item">
                  🛡️ Privacy Settings
                </Link>
                <Link to="/support" className="setting-item">
                  💬 Contact Support
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="dashboard-card activity-card">
            <div className="card-header">
              <h3>📈 Recent Activity</h3>
            </div>
            <div className="card-content">
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-icon">✅</span>
                  <div className="activity-info">
                    <span className="activity-text">Profile updated successfully</span>
                    <span className="activity-time">Today</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">🔑</span>
                  <div className="activity-info">
                    <span className="activity-text">Logged in</span>
                    <span className="activity-time">Today</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">👤</span>
                  <div className="activity-info">
                    <span className="activity-text">Account created</span>
                    <span className="activity-time">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;