import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { PWAProvider } from './contexts/PWAContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PublicRoute from './components/PublicRoute.jsx';
import OfflineIndicator from './components/OfflineIndicator.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import UpdateNotification from './components/UpdateNotification.jsx';
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import PatientManagement from './pages/admin/PatientManagement.jsx';
import PartnerManagement from './pages/admin/PartnerManagement.jsx';
import StaffManagement from './pages/admin/StaffManagement.jsx';
import ExternalEntityManagement from './pages/admin/ExternalEntityManagement.jsx';
import AccountsPayableManagement from './pages/admin/AccountsPayableManagement.jsx';
import PatientProfile from './pages/PatientProfile.jsx';
import HealthHistory from './pages/HealthHistory.jsx';
import PartnerProfile from './pages/PartnerProfile.jsx';
import PartnerDashboard from './pages/PartnerDashboard.jsx';
import PartnerReferrals from './pages/PartnerReferrals.jsx';
import PatientDocuments from './pages/PatientDocuments.jsx';
import AppointmentBooking from './pages/AppointmentBooking.jsx';
import AppointmentList from './pages/AppointmentList.jsx';
import AppointmentCalendar from './pages/AppointmentCalendar.jsx';
import PatientPaymentHistory from './pages/PatientPaymentHistory.jsx';
import InvoiceCreation from './pages/InvoiceCreation.jsx';
import ServiceManagement from './pages/admin/ServiceManagement.jsx';
import StaffShiftHistory from './pages/StaffShiftHistory.jsx';
import ShiftManagement from './pages/admin/ShiftManagement.jsx';
import Settings from './pages/Settings.jsx';
import AuditLogViewer from './pages/admin/AuditLogViewer.jsx';
import MyAuditTrail from './pages/MyAuditTrail.jsx';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PWAProvider>
          <div className="app">
            <OfflineIndicator />
            <InstallPrompt />
            <UpdateNotification />
            <NotificationPermissionPrompt />
            
            <header className="app-header">
              <nav className="nav">
                <div className="nav-brand">
                  <Link to="/" className="nav-logo">
                    WeCare
                  </Link>
                </div>
                <NavigationLinks />
              </nav>
            </header>

            <main className="main-content">
              <Routes>
                {/* Phase 1 Routes - Only implemented pages */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } />
                <Route path="/register" element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/unauthorized" element={<Unauthorized />} />
                
                {/* Phase 3: Profile Management */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/change-password" element={
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                } />
                
                {/* Phase 6: Admin Features */}
                <Route path="/admin/users" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/patients" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <PatientManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/partners" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <PartnerManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/staff" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <StaffManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/services" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['process_payments']}>
                    <ServiceManagement />
                  </ProtectedRoute>
                } />
                
                {/* Phase 4: Patient Features */}
                <Route path="/patient/profile" element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <PatientProfile />
                  </ProtectedRoute>
                } />
                <Route path="/patient/health-history" element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <HealthHistory />
                  </ProtectedRoute>
                } />
                <Route path="/patient/documents" element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <PatientDocuments />
                  </ProtectedRoute>
                } />
                <Route path="/patient/payments" element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <PatientPaymentHistory />
                  </ProtectedRoute>
                } />
                
                {/* Phase 5: Partner Features */}
                <Route path="/partner/profile" element={<ProtectedRoute allowedRoles={['partner']}><PartnerProfile /></ProtectedRoute>} />
                <Route path="/partner/dashboard" element={<ProtectedRoute allowedRoles={['partner']}><PartnerDashboard /></ProtectedRoute>} />
                <Route path="/partner/referrals" element={<ProtectedRoute allowedRoles={['partner']}><PartnerReferrals /></ProtectedRoute>} />
                
                {/* Phase 8: Appointments */}
                <Route path="/appointments/book" element={
                  <ProtectedRoute allowedRoles={['patient','staff','admin','super_admin']}>
                    <AppointmentBooking />
                  </ProtectedRoute>
                } />
                <Route path="/appointments" element={
                  <ProtectedRoute allowedRoles={['patient','staff','admin','super_admin']}>
                    <AppointmentList />
                  </ProtectedRoute>
                } />
                <Route path="/appointments/calendar" element={
                  <ProtectedRoute allowedRoles={['patient','staff','admin','super_admin']}>
                    <AppointmentCalendar />
                  </ProtectedRoute>
                } />
                
                {/* Phase 9: Invoicing */}
                <Route path="/invoices/create" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['process_payments']}>
                    <InvoiceCreation />
                  </ProtectedRoute>
                } />
                
                {/* Phase 10: Staff Shifts */}
                <Route path="/staff/shifts" element={
                  <ProtectedRoute allowedRoles={['staff', 'admin', 'super_admin']}>
                    <StaffShiftHistory />
                  </ProtectedRoute>
                } />
                <Route path="/admin/shifts" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <ShiftManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/external-entities" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']} requiredPermissions={['process_payments']}>
                    <ExternalEntityManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accounts-payable" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']} requiredPermissions={['process_payments']}>
                    <AccountsPayableManagement />
                  </ProtectedRoute>
                } />
                
                {/* Settings */}
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                
                {/* Phase 13: Audit Logs */}
                <Route path="/admin/audit-logs" element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <AuditLogViewer />
                  </ProtectedRoute>
                } />
                <Route path="/my-audit-trail" element={
                  <ProtectedRoute>
                    <MyAuditTrail />
                  </ProtectedRoute>
                } />
                
                {/* Phase 6: Admin Features
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><UserManagement /></ProtectedRoute>} />
                <Route path="/admin/patients" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><PatientManagement /></ProtectedRoute>} />
                <Route path="/admin/partners" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><PartnerManagement /></ProtectedRoute>} />
                <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><StaffManagement /></ProtectedRoute>} />
                <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['process_payments']}><ServiceManagement /></ProtectedRoute>} />
                <Route path="/admin/shifts" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><ShiftManagement /></ProtectedRoute>} />
                <Route path="/admin/external-entities" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['manage_users']}><ExternalEntityManagement /></ProtectedRoute>} />
                <Route path="/admin/accounts-payable" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['manage_users']}><AccountsPayableManagement /></ProtectedRoute>} />
                */}
                
                {/* Phase 9: Invoicing
                <Route path="/invoices/create" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'staff']} requiredPermissions={['process_payments']}><InvoiceCreation /></ProtectedRoute>} />
                */}
                
                {/* Phase 10: Staff Shifts
                <Route path="/staff/shifts" element={<ProtectedRoute allowedRoles={['staff', 'admin', 'super_admin']}><StaffShiftHistory /></ProtectedRoute>} />
                */}
                
                {/* Phase 13: Audit Logs
                <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AuditLogViewer /></ProtectedRoute>} />
                <Route path="/my-audit-trail" element={<ProtectedRoute><MyAuditTrail /></ProtectedRoute>} />
                */}
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>

            <footer className="app-footer">
              <p>&copy; 2025 WeCare Healthcare Services. All rights reserved.</p>
            </footer>
          </div>
        </PWAProvider>
      </AuthProvider>
    </Router>
  );
}

// Navigation component with conditional auth links
function NavigationLinks() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="nav-links">
      <Link to="/" className="nav-link">Home</Link>
      {user ? (
        <>
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/profile" className="nav-link">Profile</Link>
          {['admin', 'super_admin'].includes(user.role) && (
            <>
              <Link to="/admin/users" className="nav-link">Users</Link>
              <Link to="/admin/patients" className="nav-link">Patients</Link>
              <Link to="/admin/partners" className="nav-link">Partners</Link>
              <Link to="/admin/staff" className="nav-link">Staff</Link>
              <Link to="/admin/audit-logs" className="nav-link">Audit Logs</Link>
            </>
          )}
          <Link to="/my-audit-trail" className="nav-link">My Activity</Link>
          <button onClick={handleLogout} className="nav-link nav-button">Logout</button>
        </>
      ) : (
        <>
          <Link to="/login" className="nav-link">Login</Link>
          <Link to="/register" className="nav-link">Register</Link>
        </>
      )}
    </div>
  );
}



function NotFound() {
  return (
    <div className="page">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  );
}

export default App;