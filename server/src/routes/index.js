const express = require('express');
const { getConnectionStats } = require('../config/database');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const dbStats = await getConnectionStats();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: dbStats,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'WeCare PWA API',
    version: '1.0.0',
    description: 'RESTful API for WeCare Patient Portal System',
    endpoints: {
      health: 'GET /api/health',
      // Future endpoints will be added here as they are implemented
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:userId', 
        create: 'POST /api/users',
        update: 'PUT /api/users/:userId',
        deactivate: 'DELETE /api/users/:userId',
        reactivate: 'POST /api/users/:userId/reactivate'
      },
      patients: {
        info: 'GET /api/patients/me',
        update: 'PUT /api/patients/me'
      },
      appointments: {
        create: 'POST /api/appointments',
        list: 'GET /api/appointments',
        get: 'GET /api/appointments/:id',
        update: 'PUT /api/appointments/:id',
        cancel: 'PUT /api/appointments/:id/cancel',
        checkIn: 'PUT /api/appointments/:id/check-in',
        complete: 'PUT /api/appointments/:id/complete',
        stats: 'GET /api/appointments/stats'
      },
      documents: {
        list: 'GET /api/documents',
        upload: 'POST /api/documents/upload',
        get: 'GET /api/documents/:id',
        download: 'GET /api/documents/:id/download',
        view: 'GET /api/documents/:id/view',
        delete: 'DELETE /api/documents/:id',
        stats: 'GET /api/documents/stats'
      },
      services: {
        list: 'GET /api/services',
        active: 'GET /api/services/active',
        get: 'GET /api/services/:id',
        create: 'POST /api/services',
        update: 'PUT /api/services/:id',
        deactivate: 'DELETE /api/services/:id',
        reactivate: 'POST /api/services/:id/reactivate',
        stats: 'GET /api/services/stats'
      },
      invoices: {
        create: 'POST /api/invoices',
        list: 'GET /api/invoices',
        get: 'GET /api/invoices/:id',
        update: 'PUT /api/invoices/:id',
        addItem: 'POST /api/invoices/:id/items',
        removeItem: 'DELETE /api/invoices/:id/items/:itemId',
        receipt: 'GET /api/invoices/:id/receipt',
        stats: 'GET /api/invoices/stats'
      },
      payments: {
        record: 'POST /api/payments',
        list: 'GET /api/payments',
        get: 'GET /api/payments/:id',
        byInvoice: 'GET /api/payments/invoice/:invoiceId',
        report: 'GET /api/payments/report',
        stats: 'GET /api/payments/stats'
      },
      partners: {
        profile: 'GET /api/partners/profile',
        update: 'PUT /api/partners/profile',
        qr: 'GET /api/partners/qr',
        referrals: 'GET /api/partners/referrals',
        commission: 'GET /api/partners/commission'
      },
      staff: {
        list: 'GET /api/staff',
        get: 'GET /api/staff/:id',
        create: 'POST /api/staff',
        update: 'PUT /api/staff/:id',
        permissions: 'PUT /api/staff/:id/permissions',
        profile: 'GET /api/staff/profile'
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard/stats',
        revenue: 'GET /api/admin/analytics/revenue',
        users: 'GET /api/admin/analytics/users',
        health: 'GET /api/admin/system/health',
        overview: 'GET /api/admin/overview',
        export: 'GET /api/admin/export'
      },
      shifts: {
        myShifts: 'GET /api/shifts/me',
        myActiveShift: 'GET /api/shifts/me/active',
        myStats: 'GET /api/shifts/me/stats',
        allShifts: 'GET /api/shifts',
        currentlyOnShift: 'GET /api/shifts/current',
        getShift: 'GET /api/shifts/:id',
        updateShift: 'PUT /api/shifts/:id',
        monthlyReport: 'GET /api/shifts/report/monthly',
        monthlyReportPDF: 'GET /api/shifts/report/monthly/pdf'
      },
      externalEntities: {
        list: 'GET /api/external-entities',
        stats: 'GET /api/external-entities/stats',
        search: 'GET /api/external-entities/search',
        byType: 'GET /api/external-entities/type/:type',
        get: 'GET /api/external-entities/:id',
        create: 'POST /api/external-entities',
        update: 'PUT /api/external-entities/:id',
        delete: 'DELETE /api/external-entities/:id'
      },
      accountsPayable: {
        create: 'POST /api/accounts-payable',
        list: 'GET /api/accounts-payable',
        stats: 'GET /api/accounts-payable/stats',
        overdue: 'GET /api/accounts-payable/overdue',
        dueSoon: 'GET /api/accounts-payable/due-soon',
        byEntity: 'GET /api/accounts-payable/entity/:entityId',
        get: 'GET /api/accounts-payable/:id',
        update: 'PUT /api/accounts-payable/:id',
        markPaid: 'PUT /api/accounts-payable/:id/mark-paid'
      },
      notifications: {
        publicKey: 'GET /api/notifications/public-key',
        subscribe: 'POST /api/notifications/subscribe',
        unsubscribe: 'POST /api/notifications/unsubscribe',
        status: 'GET /api/notifications/subscription-status',
        test: 'POST /api/notifications/test',
        sendToUsers: 'POST /api/notifications/send-to-users',
        sendToRole: 'POST /api/notifications/send-to-role',
        broadcast: 'POST /api/notifications/broadcast'
      },
      auditLogs: {
        list: 'GET /api/audit-logs',
        search: 'GET /api/audit-logs/search',
        statistics: 'GET /api/audit-logs/statistics',
        export: 'GET /api/audit-logs/export',
        myTrail: 'GET /api/audit-logs/my-trail',
        byUser: 'GET /api/audit-logs/user/:userId',
        byEntity: 'GET /api/audit-logs/entity/:entityType/:entityId',
        get: 'GET /api/audit-logs/:logId'
      }
    },
    documentation: 'https://docs.wecare.com/api',
    support: 'support@wecare.com'
  });
});

// Route imports
const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

// Phase 3 - User Management Routes
const userRoutes = require('./userRoutes');
router.use('/users', userRoutes);

// Future phase routes are commented out until implemented

// Phase 4 - Patient Routes
const patientRoutes = require('./patientRoutes');
router.use('/patients', patientRoutes);

// Phase 5 - Partner Routes
const partnerRoutes = require('./partnerRoutes');
router.use('/partners', partnerRoutes);

// Phase 8 - Appointment Routes
const appointmentRoutes = require('./appointmentRoutes');
router.use('/appointments', appointmentRoutes);

// Phase 7 - Document Routes
const documentRoutes = require('./documentRoutes');
router.use('/documents', documentRoutes);

// Phase 9 - Service Routes (COMMENTED FOR PHASE 1)
// const serviceRoutes = require('./serviceRoutes');
// router.use('/services', serviceRoutes);

// Phase 9 - Invoice Routes
const invoiceRoutes = require('./invoiceRoutes');
router.use('/invoices', invoiceRoutes);

// Phase 9 - Payment Routes (COMMENTED FOR PHASE 1)
// const paymentRoutes = require('./paymentRoutes');
// router.use('/payments', paymentRoutes);

// Phase 6 - Staff Routes (COMMENTED FOR PHASE 1)
// const staffRoutes = require('./staffRoutes');
// router.use('/staff', staffRoutes);

// Phase 6 - Admin Routes (COMMENTED FOR PHASE 1)
// const adminRoutes = require('./adminRoutes');
// router.use('/admin', adminRoutes);

// Phase 10 - Shift Routes (COMMENTED FOR PHASE 1)
// const shiftRoutes = require('./shiftRoutes');
// router.use('/shifts', shiftRoutes);

// Phase 11 - External Entity Routes (COMMENTED FOR PHASE 1)
// const externalEntityRoutes = require('./externalEntityRoutes');
// router.use('/external-entities', externalEntityRoutes);

// Phase 11 - Accounts Payable Routes (COMMENTED FOR PHASE 1)
// const accountsPayableRoutes = require('./accountsPayableRoutes');
// router.use('/accounts-payable', accountsPayableRoutes);

// Phase 12 - Push Notification Routes (PWA) (COMMENTED FOR PHASE 1)
// const notificationRoutes = require('./notificationRoutes');
// router.use('/notifications', notificationRoutes);

// Phase 13 - Audit Log Routes (Security & Compliance) (COMMENTED FOR PHASE 1)
// const auditLogRoutes = require('./auditLogRoutes');
// router.use('/audit-logs', auditLogRoutes);

// Phase 9 - Report Routes (COMMENTED FOR PHASE 1)
// const reportRoutes = require('./reportRoutes');
// router.use('/reports', reportRoutes);

// Phase 9 - Analytics Routes (COMMENTED FOR PHASE 1)
// const analyticsRoutes = require('./analyticsRoutes');
// router.use('/analytics', analyticsRoutes);

module.exports = router;