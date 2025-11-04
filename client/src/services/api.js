import axios from 'axios';
import { addFailedRequest } from '../utils/requestQueue';

/**
 * Check if a request is safe to retry when offline
 * Excludes auth, multipart uploads, blob downloads, and other unsafe operations
 */
function isRetryableRequest(config) {
  // Don't retry auth requests
  if (config.url && config.url.includes('/auth')) {
    return false;
  }

  // Don't retry multipart/form-data (file uploads)
  if (config.headers && config.headers['Content-Type'] === 'multipart/form-data') {
    return false;
  }

  // Don't retry blob downloads
  if (config.responseType === 'blob') {
    return false;
  }

  // Only allow specific safe methods
  const method = config.method ? config.method.toUpperCase() : '';
  const safeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!safeMethods.includes(method)) {
    return false;
  }

  return true;
}

// Create axios instance with default configuration
const api = axios.create({
  baseURL: '/api', // Vite proxy will forward this to http://localhost:5000/api
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for session management
});

// Request interceptor to attach authorization tokens and handle offline queueing
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage (will be implemented in Phase 2)
    const token = localStorage.getItem('wecare_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Pre-queue request if offline and retryable
    if (!navigator.onLine && isRetryableRequest(config)) {
      // Queue immediately since we're offline
      addFailedRequest({
        url: config.url,
        method: config.method,
        body: config.data,
        params: config.params,
        headers: config.headers
      }).catch(err => console.error('Failed to pre-queue request:', err));

      // Still reject to prevent hanging requests
      return Promise.reject({
        message: 'No internet connection. Request queued for retry.',
        type: 'OFFLINE_QUEUED',
        config
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling and token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized responses
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh token using apiService.auth.refreshToken()
        const newToken = await apiService.auth.refreshToken();
        
        localStorage.setItem('wecare_token', newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('wecare_token');
        window.location.href = '/login';
      }
    }

    // Handle network errors - queue failed requests for offline retry
    if (!error.response) {
      console.error('Network error:', error.message);
      
      // Queue the request if offline and retryable
      if (!navigator.onLine && isRetryableRequest(originalRequest)) {
        try {
          await addFailedRequest({
            url: originalRequest.url,
            method: originalRequest.method,
            body: originalRequest.data, // Use 'body' to match requestQueue.js
            params: originalRequest.params,
            headers: originalRequest.headers
          });
          console.log('Request queued for retry when online');
        } catch (queueError) {
          console.error('Failed to queue request:', queueError);
        }
      }
      
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        type: 'NETWORK_ERROR'
      });
    }

    // Handle other HTTP errors
    const errorMessage = error.response?.data?.error?.message || 
                         error.response?.data?.message || 
                         error.message || 
                         'An unexpected error occurred';
    
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

// API service methods (to be expanded in future phases)
export const apiService = {
  // Generic HTTP methods
  async get(url, params = {}) {
    const response = await api.get(url, { params });
    return response.data;
  },
  async post(url, data = {}) {
    const response = await api.post(url, data);
    return response.data;
  },
  async put(url, data = {}) {
    const response = await api.put(url, data);
    return response.data;
  },
  async delete(url) {
    const response = await api.delete(url);
    return response.data;
  },

  // Health check
  async healthCheck() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Authentication methods (Phase 2)
  auth: {
    async login(credentials) {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    },
    async register(userData) {
      const response = await api.post('/auth/register', userData);
      return response.data;
    },
    async logout() {
      const response = await api.post('/auth/logout');
      return response.data;
    },
    async refreshToken() {
      const response = await api.post('/auth/refresh');
      return response.data.data.accessToken;
    }
  },

  // User management methods (Phase 3)
  users: {
    // Profile management (self-service)
    async getProfile() {
      const response = await api.get('/auth/me');
      return response.data;
    },
    async updateProfile(userData) {
      const response = await api.put('/auth/profile', userData);
      return response.data;
    },
    async changePassword(passwordData) {
      const response = await api.put('/auth/password', passwordData);
      return response.data;
    },

    // Admin user management operations
    async getAllUsers(params = {}) {
      const response = await api.get('/users', { params });
      return response.data;
    },
    async getUserById(id) {
      const response = await api.get(`/users/${id}`);
      return response.data;
    },
    async createUser(userData) {
      const response = await api.post('/users', userData);
      return response.data;
    },
    async updateUser(id, userData) {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    },
    async deactivate(id) {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    },
    async reactivate(id) {
      const response = await api.post(`/users/${id}/reactivate`);
      return response.data;
    },
    // Search users by name or email
    async search(searchTerm = '') {
      const response = await api.get('/users/search', { params: { q: searchTerm } });
      return response.data;
    }
  },

  // Patient methods (Phase 4)
  patients: {
    async getPatientInfo() {
      const response = await api.get('/patients/me');
      return response.data;
    },
    async updatePatientInfo(patientData) {
      const response = await api.put('/patients/me', patientData);
      return response.data;
    },
    async getHealthHistory(params = {}) {
      const response = await api.get('/patients/me/health-history', { params });
      return response.data;
    },
    // Admin methods for patient management
    async getAllPatients(params = {}) {
      const response = await api.get('/patients', { params });
      return response.data;
    },
    // Search patients for invoice creation (staff with process_payments)
    async searchPatients(searchTerm = '') {
      const response = await api.get('/patients/search', { params: { q: searchTerm } });
      return response.data;
    }
  },

  // Appointment methods (Phase 8)
  appointments: {
    async getAppointments(params = {}) {
      const response = await api.get('/appointments', { params });
      return response.data;
    },
    async getAppointmentById(id) {
      const response = await api.get(`/appointments/${id}`);
      return response.data;
    },
    async createAppointment(appointmentData) {
      const response = await api.post('/appointments', appointmentData);
      return response.data;
    },
    async updateAppointment(id, appointmentData) {
      const response = await api.put(`/appointments/${id}`, appointmentData);
      return response.data;
    },
    async cancelAppointment(id) {
      const response = await api.put(`/appointments/${id}/cancel`);
      return response.data;
    },
    async checkInAppointment(id) {
      const response = await api.put(`/appointments/${id}/check-in`);
      return response.data;
    },
    async completeAppointment(id, notes = null) {
      const response = await api.put(`/appointments/${id}/complete`, { notes });
      return response.data;
    },
    async getAppointmentStats() {
      const response = await api.get('/appointments/stats');
      return response.data;
    }
  },

  // Document methods (Phase 7)
  documents: {
    async getConfig() {
      const response = await api.get('/documents/config');
      return response.data;
    },
    async getDocuments(params = {}) {
      const response = await api.get('/documents', { params });
      return response.data;
    },
    async getDocumentById(id) {
      const response = await api.get(`/documents/${id}`);
      return response.data;
    },
    async uploadDocument(formData, config = {}) {
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        ...config
      });
      return response.data;
    },
    async downloadDocument(id) {
      try {
        const response = await api.get(`/documents/${id}/download`, {
          responseType: 'blob',
        });
        // Check for error header in blob response
        const errorMessage = response.headers['x-error-message'];
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        
        // Extract filename from Content-Disposition header if available
        let filename = null;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          // Try to parse RFC 5987 encoded filename (filename*=UTF-8''...)
          const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (filenameStarMatch) {
            filename = decodeURIComponent(filenameStarMatch[1]);
          } else {
            // Fall back to standard filename="..."
            const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/i);
            if (filenameMatch) {
              filename = filenameMatch[1];
            }
          }
        }
        
        return {
          blob: response.data,
          filename: filename
        };
      } catch (error) {
        // Re-throw with error message from header if available
        if (error.response?.headers['x-error-message']) {
          throw new Error(error.response.headers['x-error-message']);
        }
        throw error;
      }
    },
    async viewDocument(id) {
      try {
        const response = await api.get(`/documents/${id}/view`, {
          responseType: 'blob',
        });
        // Check for error header in blob response
        const errorMessage = response.headers['x-error-message'];
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        return response.data;
      } catch (error) {
        // Re-throw with error message from header if available
        if (error.response?.headers['x-error-message']) {
          throw new Error(error.response.headers['x-error-message']);
        }
        throw error;
      }
    },
    async deleteDocument(id) {
      const response = await api.delete(`/documents/${id}`);
      return response.data;
    },
    async getDocumentStats() {
      const response = await api.get('/documents/stats');
      return response.data;
    }
  },

  // Partner methods (Phase 5)
  partners: {
    async getPartnerInfo() {
      const response = await api.get('/partners/profile');
      return response.data;
    },
    async updatePartnerInfo(partnerData) {
      const response = await api.put('/partners/profile', partnerData);
      return response.data;
    },
    async getReferrals(params = {}) {
      const response = await api.get('/partners/referrals', { params });
      return response.data;
    },
    async getStats() {
      const response = await api.get('/partners/stats');
      return response.data;
    },
    async getQRCode() {
      const response = await api.get('/partners/qrcode');
      return response.data;
    },
    async getCommissionHistory(params = {}) {
      const response = await api.get('/partners/commission-history', { params });
      return response.data;
    },
    // Admin methods for partner management
    async getAllPartners(params = {}) {
      const response = await api.get('/partners', { params });
      return response.data;
    },
    async getReferralsByPartner(partnerId, params = {}) {
      const response = await api.get(`/partners/${partnerId}/referrals`, { params });
      return response.data;
    }
  },

  // Invoice methods (Phase 9)
  invoices: {
    async getInvoices(params = {}) {
      const response = await api.get('/invoices', { params });
      return response.data;
    },
    async getInvoiceById(id) {
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    },
    async createInvoice(invoiceData) {
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    },
    async updateInvoice(id, invoiceData) {
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    },
    async addInvoiceItem(id, itemData) {
      const response = await api.post(`/invoices/${id}/items`, itemData);
      return response.data;
    },
    async removeInvoiceItem(id, itemId) {
      const response = await api.delete(`/invoices/${id}/items/${itemId}`);
      return response.data;
    },
    async downloadReceipt(id) {
      const response = await api.get(`/invoices/${id}/receipt`, {
        responseType: 'blob'
      });
      return response.data;
    },
    async getInvoiceStats() {
      const response = await api.get('/invoices/stats');
      return response.data;
    },
    async getMyInvoiceStats() {
      const response = await api.get('/invoices/my/stats');
      return response.data;
    }
  },

  // Service methods (Phase 9)
  services: {
    async getAllServices(params = {}) {
      const response = await api.get('/services', { params });
      return response.data;
    },
    async getActiveServices(category = null) {
      const response = await api.get('/services/active', {
        params: category ? { category } : {}
      });
      return response.data;
    },
    async getServiceById(id) {
      const response = await api.get(`/services/${id}`);
      return response.data;
    },
    async createService(serviceData) {
      const response = await api.post('/services', serviceData);
      return response.data;
    },
    async updateService(id, serviceData) {
      const response = await api.put(`/services/${id}`, serviceData);
      return response.data;
    },
    async deactivateService(id) {
      const response = await api.delete(`/services/${id}`);
      return response.data;
    },
    async reactivateService(id) {
      const response = await api.post(`/services/${id}/reactivate`);
      return response.data;
    },
    async getServiceStats() {
      const response = await api.get('/services/stats');
      return response.data;
    }
  },

  // Payment methods (Phase 9)
  payments: {
    async recordPayment(paymentData) {
      const response = await api.post('/payments', paymentData);
      return response.data;
    },
    async getPayments(params = {}) {
      const response = await api.get('/payments', { params });
      return response.data;
    },
    async getPaymentById(id) {
      const response = await api.get(`/payments/${id}`);
      return response.data;
    },
    async getPaymentsByInvoice(invoiceId) {
      const response = await api.get(`/payments/invoice/${invoiceId}`);
      return response.data;
    },
    async generateReport(params = {}) {
      const response = await api.get('/payments/report', {
        params,
        responseType: 'blob'
      });
      return response.data;
    },
    async getPaymentStats() {
      const response = await api.get('/payments/stats');
      return response.data;
    }
  },

  // Staff methods (Phase 6)
  staff: {
    async getAllStaff(params = {}) {
      const response = await api.get('/staff', { params });
      return response.data;
    },
    async getStaffById(id) {
      const response = await api.get(`/staff/${id}`);
      return response.data;
    },
    async createStaff(staffData) {
      const response = await api.post('/staff', staffData);
      return response.data;
    },
    async updateStaff(id, staffData) {
      const response = await api.put(`/staff/${id}`, staffData);
      return response.data;
    },
    async updateStaffPermissions(id, permissions) {
      const response = await api.put(`/staff/${id}/permissions`, { permissions });
      return response.data;
    },
    async getCurrentProfile() {
      const response = await api.get('/staff/profile');
      return response.data;
    },
    async updateCurrentProfile(profileData) {
      const response = await api.put('/staff/profile', profileData);
      return response.data;
    },
    async getAvailablePermissions() {
      const response = await api.get('/staff/permissions');
      return response.data;
    }
  },

  // Shift methods (Phase 10)
  shifts: {
    async getMyShifts(params = {}) {
      const response = await api.get('/shifts/me', { params });
      return response.data;
    },
    async getMyActiveShift() {
      const response = await api.get('/shifts/me/active');
      return response.data;
    },
    async getMyShiftStats(params = {}) {
      const response = await api.get('/shifts/me/stats', { params });
      return response.data;
    },
    async getAllShifts(params = {}) {
      const response = await api.get('/shifts', { params });
      return response.data;
    },
    async getShiftById(id) {
      const response = await api.get(`/shifts/${id}`);
      return response.data;
    },
    async updateShift(id, shiftData) {
      const response = await api.put(`/shifts/${id}`, shiftData);
      return response.data;
    },
    async getMonthlyReport(params = {}) {
      const response = await api.get('/shifts/report/monthly', { params });
      return response.data;
    },
    async downloadMonthlyReportPDF(params = {}) {
      const response = await api.get('/shifts/report/monthly/pdf', {
        params,
        responseType: 'blob'
      });
      return response.data;
    },
    async getCurrentlyOnShift() {
      const response = await api.get('/shifts/current');
      return response.data;
    }
  },

  // Admin methods (Phase 6)
  admin: {
    async getDashboardStats() {
      const response = await api.get('/admin/dashboard/stats');
      return response.data;
    },
    async getRevenueAnalytics(period = 'month') {
      const response = await api.get('/admin/analytics/revenue', { params: { period } });
      return response.data;
    },
    async getUserActivityAnalytics(period = 'month') {
      const response = await api.get('/admin/analytics/users', { params: { period } });
      return response.data;
    },
    async getSystemHealth() {
      const response = await api.get('/admin/system/health');
      return response.data;
    },
    async getAdminOverview() {
      const response = await api.get('/admin/overview');
      return response.data;
    },
    async exportData(type, format = 'json', period = 'month') {
      const response = await api.get('/admin/export', { 
        params: { type, format, period },
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      return response.data;
    }
  },

  // External Entities methods (Phase 11)
  externalEntities: {
    async list(params = {}) {
      const response = await api.get('/external-entities', { params });
      return response.data;
    },
    async get(id) {
      const response = await api.get(`/external-entities/${id}`);
      return response.data;
    },
    async create(entityData) {
      const response = await api.post('/external-entities', entityData);
      return response.data;
    },
    async update(id, entityData) {
      const response = await api.put(`/external-entities/${id}`, entityData);
      return response.data;
    },
    async delete(id) {
      const response = await api.delete(`/external-entities/${id}`);
      return response.data;
    },
    async getByType(type) {
      const response = await api.get(`/external-entities/type/${type}`);
      return response.data;
    },
    async search(searchTerm) {
      const response = await api.get('/external-entities/search', { params: { q: searchTerm } });
      return response.data;
    },
    async getStats() {
      const response = await api.get('/external-entities/stats');
      return response.data;
    }
  },

  // Accounts Payable methods (Phase 11)
  accountsPayable: {
    async create(payableData) {
      const response = await api.post('/accounts-payable', payableData);
      return response.data;
    },
    async list(params = {}) {
      const response = await api.get('/accounts-payable', { params });
      return response.data;
    },
    async get(id) {
      const response = await api.get(`/accounts-payable/${id}`);
      return response.data;
    },
    async update(id, payableData) {
      const response = await api.put(`/accounts-payable/${id}`, payableData);
      return response.data;
    },
    async markAsPaid(id, paidData) {
      const response = await api.put(`/accounts-payable/${id}/mark-paid`, paidData);
      return response.data;
    },
    async getOverdue() {
      const response = await api.get('/accounts-payable/overdue');
      return response.data;
    },
    async getDueSoon(days = 7) {
      const response = await api.get('/accounts-payable/due-soon', { params: { days } });
      return response.data;
    },
    async getByEntity(entityId, params = {}) {
      const response = await api.get(`/accounts-payable/entity/${entityId}`, { params });
      return response.data;
    },
    async getStats() {
      const response = await api.get('/accounts-payable/stats');
      return response.data;
    }
  },

  // Push Notifications methods (Phase 12 - optional)
  notifications: {
    async getPublicKey() {
      const response = await api.get('/notifications/public-key');
      return response.data;
    },
    async subscribe(subscription) {
      // Transform PushSubscription to server format and wrap in { subscription }
      const subscriptionPayload = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      };
      // Server expects { subscription: {...} }
      const response = await api.post('/notifications/subscribe', { subscription: subscriptionPayload });
      return response.data;
    },
    async unsubscribe() {
      const response = await api.post('/notifications/unsubscribe');
      return response.data;
    },
    async getSubscriptionStatus() {
      const response = await api.get('/notifications/subscription-status');
      return response.data;
    },
    async sendTestNotification() {
      const response = await api.post('/notifications/test');
      return response.data;
    }
  },

  // Audit Logs methods (Phase 13)
  auditLogs: {
    async getAll(filters = {}) {
      const response = await api.get('/audit-logs', { params: filters });
      return response.data;
    },
    async search(searchParams = {}) {
      const response = await api.get('/audit-logs/search', { params: searchParams });
      return response.data;
    },
    async getStatistics(dateRange = {}) {
      const response = await api.get('/audit-logs/statistics', { params: dateRange });
      return response.data;
    },
    async exportLogs(filters = {}) {
      const response = await api.get('/audit-logs/export', { params: filters });
      return response.data;
    },
    async getMyTrail(options = {}) {
      const response = await api.get('/audit-logs/my-trail', { params: options });
      return response.data;
    },
    async getByUser(userId, options = {}) {
      const response = await api.get(`/audit-logs/user/${userId}`, { params: options });
      return response.data;
    },
    async getByEntity(entityType, entityId, options = {}) {
      const response = await api.get(`/audit-logs/entity/${entityType}/${entityId}`, { params: options });
      return response.data;
    },
    async getById(logId) {
      const response = await api.get(`/audit-logs/${logId}`);
      return response.data;
    }
  }
};

export default api;