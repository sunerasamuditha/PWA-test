const { executeQuery } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class AdminService {
  /**
   * Get dashboard statistics
   * @returns {Object} Dashboard statistics
   */
  static async getDashboardStats() {
    try {
      const stats = {};

      // Get user statistics
      const userStatsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'patient' THEN 1 END) as total_patients,
          COUNT(CASE WHEN role = 'partner' THEN 1 END) as total_partners,
          COUNT(CASE WHEN role = 'staff' THEN 1 END) as total_staff,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
          COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as total_super_admins,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as new_users_today,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as new_users_week,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as new_users_month
        FROM \`Users\` 
        WHERE deleted_at IS NULL
      `;
      
      const [userStats] = await executeQuery(userStatsQuery);
      stats.users = userStats;

      // Get patient statistics (with error handling for missing table)
      try {
        const patientStatsQuery = `
          SELECT 
            COUNT(*) as total_patients,
            COUNT(CASE WHEN JSON_VALID(passport_info) AND JSON_LENGTH(passport_info) > 0 THEN 1 END) as patients_with_passport,
            COUNT(CASE WHEN JSON_VALID(insurance_info) AND JSON_LENGTH(insurance_info) > 0 THEN 1 END) as patients_with_insurance,
            COUNT(CASE WHEN 
              (JSON_VALID(passport_info) AND JSON_LENGTH(passport_info) > 0) AND 
              (JSON_VALID(insurance_info) AND JSON_LENGTH(insurance_info) > 0) 
            THEN 1 END) as patients_fully_documented
          FROM \`Patients\`
          WHERE deleted_at IS NULL
        `;
        
        const [patientStats] = await executeQuery(patientStatsQuery);
        stats.patients = patientStats;
      } catch (error) {
        console.warn('Patients table not found, skipping patient statistics');
        stats.patients = {
          total_patients: 0,
          patients_with_passport: 0,
          patients_with_insurance: 0,
          patients_fully_documented: 0
        };
      }

      // Get staff statistics (with error handling for missing table)
      try {
        const staffStatsQuery = `
          SELECT 
            COUNT(*) as total_staff_members,
            COUNT(CASE WHEN staff_role = 'front_desk' THEN 1 END) as front_desk_staff,
            COUNT(CASE WHEN staff_role = 'back_office' THEN 1 END) as back_office_staff,
            COUNT(CASE WHEN staff_role = 'admin' THEN 1 END) as admin_staff,
            COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as new_staff_month
          FROM \`Staff_Members\`
          WHERE deleted_at IS NULL
        `;
        
        const [staffStats] = await executeQuery(staffStatsQuery);
        stats.staffMembers = staffStats;
      } catch (error) {
        console.warn('Staff_Members table not found, skipping staff statistics');
        stats.staffMembers = {
          total_staff_members: 0,
          front_desk_staff: 0,
          back_office_staff: 0,
          admin_staff: 0,
          new_staff_month: 0
        };
      }

      // Get appointment statistics (with error handling for missing table)
      try {
        // Use business timezone for accurate "today" calculation
        const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';
        
        const appointmentStatsQuery = `
          SELECT 
            COUNT(*) as total_appointments,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_appointments,
            COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in_appointments,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
            COUNT(CASE WHEN DATE(CONVERT_TZ(appointment_datetime, '+00:00', ?)) = DATE(CONVERT_TZ(NOW(), '+00:00', ?)) THEN 1 END) as appointments_today,
            COUNT(CASE WHEN appointment_datetime > NOW() AND status = 'scheduled' THEN 1 END) as upcoming_appointments
          FROM \`Appointments\`
        `;
        
        const rows = await executeQuery(appointmentStatsQuery, [businessTimezone, businessTimezone]);
        stats.appointments = rows[0] || {
          total_appointments: 0,
          scheduled_appointments: 0,
          checked_in_appointments: 0,
          completed_appointments: 0,
          cancelled_appointments: 0,
          appointments_today: 0,
          upcoming_appointments: 0
        };
      } catch (error) {
        console.warn('Appointments table not found, skipping appointment statistics');
        stats.appointments = {
          total_appointments: 0,
          scheduled_appointments: 0,
          checked_in_appointments: 0,
          cancelled_appointments: 0,
          appointments_today: 0,
          upcoming_appointments: 0
        };
      }

      // Get payment statistics (with error handling for missing table)
      try {
        const paymentStatsQuery = `
          SELECT 
            COUNT(*) as total_payments,
            SUM(amount) as total_revenue,
            COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
            SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as completed_revenue,
            COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
            SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as pending_revenue,
            COUNT(CASE WHEN DATE(paid_at) = CURDATE() THEN 1 END) as payments_today,
            SUM(CASE WHEN DATE(paid_at) = CURDATE() THEN amount ELSE 0 END) as revenue_today,
            COUNT(CASE WHEN DATE(paid_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as payments_week,
            SUM(CASE WHEN DATE(paid_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN amount ELSE 0 END) as revenue_week,
            COUNT(CASE WHEN DATE(paid_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as payments_month,
            SUM(CASE WHEN DATE(paid_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN amount ELSE 0 END) as revenue_month
          FROM Payments
        `;
        
        const rows = await executeQuery(paymentStatsQuery);
        stats.payments = {
          total_payments: rows[0].total_payments || 0,
          total_revenue: parseFloat(rows[0].total_revenue || 0),
          completed_payments: rows[0].completed_payments || 0,
          completed_revenue: parseFloat(rows[0].completed_revenue || 0),
          pending_payments: rows[0].pending_payments || 0,
          pending_revenue: parseFloat(rows[0].pending_revenue || 0),
          payments_today: rows[0].payments_today || 0,
          revenue_today: parseFloat(rows[0].revenue_today || 0),
          payments_week: rows[0].payments_week || 0,
          revenue_week: parseFloat(rows[0].revenue_week || 0),
          payments_month: rows[0].payments_month || 0,
          revenue_month: parseFloat(rows[0].revenue_month || 0)
        };
      } catch (error) {
        console.warn('Payments table not found, skipping payment statistics');
        stats.payments = {
          total_payments: 0,
          total_revenue: 0,
          completed_payments: 0,
          completed_revenue: 0,
          pending_payments: 0,
          pending_revenue: 0,
          payments_today: 0,
          revenue_today: 0,
          payments_week: 0,
          revenue_week: 0,
          payments_month: 0,
          revenue_month: 0
        };
      }

      // Get invoice statistics
      try {
        const invoiceStatsQuery = `
          SELECT 
            COUNT(*) as total_invoices,
            COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_invoices,
            COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_invoices,
            COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) as overdue_invoices,
            COUNT(CASE WHEN i.status = 'partially_paid' THEN 1 END) as partially_paid_invoices,
            SUM(i.total_amount) as total_billed,
            SUM(i.total_amount - COALESCE(p.paid_amount, 0)) as total_outstanding
          FROM Invoices i
          LEFT JOIN (
            SELECT 
              invoice_id,
              SUM(amount) as paid_amount
            FROM Payments
            WHERE payment_status = 'completed'
            GROUP BY invoice_id
          ) p ON i.id = p.invoice_id
        `;
        
        const rows = await executeQuery(invoiceStatsQuery);
        stats.invoices = {
          totalInvoices: rows[0].total_invoices || 0,
          pendingCount: rows[0].pending_invoices || 0,
          paidCount: rows[0].paid_invoices || 0,
          overdueCount: rows[0].overdue_invoices || 0,
          partiallyPaidCount: rows[0].partially_paid_invoices || 0,
          totalBilled: parseFloat(rows[0].total_billed || 0),
          totalOutstanding: parseFloat(rows[0].total_outstanding || 0)
        };
      } catch (error) {
        console.warn('Invoices table not found, skipping invoice statistics');
        stats.invoices = {
          totalInvoices: 0,
          pendingCount: 0,
          paidCount: 0,
          overdueCount: 0,
          partiallyPaidCount: 0,
          totalBilled: 0,
          totalOutstanding: 0
        };
      }

      // Get partner statistics (with error handling for missing table)
      try {
        const partnerStatsQuery = `
          SELECT 
            COUNT(*) as total_partners,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_partners,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_partners,
            COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_partners,
            SUM(total_referrals) as total_referrals,
            SUM(successful_referrals) as successful_referrals,
            SUM(total_commission_earned) as total_commission_earned,
            COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as new_partners_month
          FROM \`Partners\` 
          WHERE deleted_at IS NULL
        `;
        
        const [partnerStats] = await executeQuery(partnerStatsQuery);
        stats.partners = {
          ...partnerStats,
          total_commission_earned: parseFloat(partnerStats.total_commission_earned || 0)
        };
      } catch (error) {
        console.warn('Partners table not found, skipping partner statistics');
        stats.partners = {
          total_partners: 0,
          active_partners: 0,
          pending_partners: 0,
          suspended_partners: 0,
          total_referrals: 0,
          successful_referrals: 0,
          total_commission_earned: 0,
          new_partners_month: 0
        };
      }

      // Get shift statistics (with error handling for missing table)
      try {
        // Staff currently on shift
        const [currentlyOnShiftRow] = await executeQuery(`
          SELECT COUNT(*) as count
          FROM Staff_Shifts
          WHERE logout_at IS NULL
        `);
        
        // Total shifts and hours today
        const [todayStatsRow] = await executeQuery(`
          SELECT 
            COUNT(*) as total_shifts,
            COALESCE(SUM(total_hours), 0) as total_hours
          FROM Staff_Shifts
          WHERE DATE(login_at) = CURDATE()
        `);
        
        // Total shifts and hours this week
        const [weekStatsRow] = await executeQuery(`
          SELECT 
            COUNT(*) as total_shifts,
            COALESCE(SUM(total_hours), 0) as total_hours
          FROM Staff_Shifts
          WHERE login_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        
        // Total shifts and hours this month
        const [monthStatsRow] = await executeQuery(`
          SELECT 
            COUNT(*) as total_shifts,
            COALESCE(SUM(total_hours), 0) as total_hours
          FROM Staff_Shifts
          WHERE login_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `);
        
        // Hours by shift type (last 30 days)
        const shiftsByType = await executeQuery(`
          SELECT 
            shift_type,
            COUNT(*) as shift_count,
            COALESCE(SUM(total_hours), 0) as total_hours
          FROM Staff_Shifts
          WHERE login_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY shift_type
        `);
        
        const hoursByShiftType = {};
        shiftsByType.forEach(row => {
          hoursByShiftType[row.shift_type] = {
            count: parseInt(row.shift_count),
            hours: parseFloat(row.total_hours)
          };
        });
        
        stats.shifts = {
          staff_currently_on_shift: currentlyOnShiftRow.count,
          total_shifts_today: todayStatsRow.total_shifts,
          total_hours_today: parseFloat(todayStatsRow.total_hours),
          total_shifts_week: weekStatsRow.total_shifts,
          total_hours_week: parseFloat(weekStatsRow.total_hours),
          total_shifts_month: monthStatsRow.total_shifts,
          total_hours_month: parseFloat(monthStatsRow.total_hours),
          shifts_by_type: hoursByShiftType
        };
      } catch (error) {
        console.warn('Staff_Shifts table not found or error fetching shift statistics:', error.message);
        stats.shifts = {
          staff_currently_on_shift: 0,
          total_shifts_today: 0,
          total_hours_today: 0,
          total_shifts_week: 0,
          total_hours_week: 0,
          total_shifts_month: 0,
          total_hours_month: 0,
          shifts_by_type: {}
        };
      }

      // Get external entities statistics (with error handling for missing table)
      try {
        const entitiesStatsQuery = `
          SELECT 
            COUNT(*) as total_entities,
            COUNT(CASE WHEN type = 'hospital' THEN 1 END) as hospitals,
            COUNT(CASE WHEN type = 'lab' THEN 1 END) as labs,
            COUNT(CASE WHEN type = 'supplier' THEN 1 END) as suppliers,
            COUNT(CASE WHEN type = 'insurance_company' THEN 1 END) as insurance_companies,
            COUNT(CASE WHEN type = 'other' THEN 1 END) as other_entities,
            COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as new_entities_month
          FROM External_Entities
        `;
        
        const [entitiesStats] = await executeQuery(entitiesStatsQuery);
        stats.externalEntities = {
          totalEntities: entitiesStats.total_entities || 0,
          byType: {
            hospital: entitiesStats.hospitals || 0,
            lab: entitiesStats.labs || 0,
            supplier: entitiesStats.suppliers || 0,
            insurance_company: entitiesStats.insurance_companies || 0,
            other: entitiesStats.other_entities || 0
          },
          newEntitiesMonth: entitiesStats.new_entities_month || 0
        };
      } catch (error) {
        console.warn('External_Entities table not found, skipping external entities statistics');
        stats.externalEntities = {
          totalEntities: 0,
          byType: {
            hospital: 0,
            lab: 0,
            supplier: 0,
            insurance_company: 0,
            other: 0
          },
          newEntitiesMonth: 0
        };
      }

      // Get accounts payable statistics (with error handling for missing table)
      try {
        const payablesStatsQuery = `
          SELECT 
            COUNT(*) as total_payables,
            COUNT(CASE WHEN status = 'due' THEN 1 END) as due_count,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
            SUM(total_amount) as total_amount,
            SUM(CASE WHEN status = 'due' THEN total_amount ELSE 0 END) as due_amount,
            SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as overdue_amount,
            COUNT(CASE WHEN status IN ('due', 'overdue') AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as due_soon_count,
            SUM(CASE WHEN status IN ('due', 'overdue') AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN total_amount ELSE 0 END) as due_soon_amount
          FROM Accounts_Payable
        `;
        
        const [payablesStats] = await executeQuery(payablesStatsQuery);
        
        // Get payables by entity type
        const payablesByTypeQuery = `
          SELECT 
            ee.type,
            COUNT(ap.id) as count,
            SUM(ap.total_amount) as total_amount,
            SUM(CASE WHEN ap.status = 'overdue' THEN ap.total_amount ELSE 0 END) as overdue_amount
          FROM Accounts_Payable ap
          LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
          WHERE ap.status IN ('due', 'overdue')
          GROUP BY ee.type
        `;
        
        const payablesByType = await executeQuery(payablesByTypeQuery);
        
        const byEntityType = {};
        payablesByType.forEach(row => {
          byEntityType[row.type || 'unknown'] = {
            count: parseInt(row.count),
            totalAmount: parseFloat(row.total_amount || 0),
            overdueAmount: parseFloat(row.overdue_amount || 0)
          };
        });
        
        stats.accountsPayable = {
          totalPayables: payablesStats.total_payables || 0,
          dueCount: payablesStats.due_count || 0,
          paidCount: payablesStats.paid_count || 0,
          overdueCount: payablesStats.overdue_count || 0,
          totalAmount: parseFloat(payablesStats.total_amount || 0),
          dueAmount: parseFloat(payablesStats.due_amount || 0),
          paidAmount: parseFloat(payablesStats.paid_amount || 0),
          overdueAmount: parseFloat(payablesStats.overdue_amount || 0),
          dueSoonCount: payablesStats.due_soon_count || 0,
          dueSoonAmount: parseFloat(payablesStats.due_soon_amount || 0),
          byEntityType: byEntityType
        };
      } catch (error) {
        console.warn('Accounts_Payable table not found, skipping accounts payable statistics');
        stats.accountsPayable = {
          totalPayables: 0,
          dueCount: 0,
          paidCount: 0,
          overdueCount: 0,
          totalAmount: 0,
          dueAmount: 0,
          paidAmount: 0,
          overdueAmount: 0,
          dueSoonCount: 0,
          dueSoonAmount: 0,
          byEntityType: {}
        };
      }

      // Get recent activity (with error handling for missing tables)
      const recentActivityQuery = `
        (
          SELECT 
            'user_registration' as type,
            CONCAT('New user registered: ', full_name) as description,
            created_at as timestamp
          FROM \`Users\` 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND deleted_at IS NULL
        )
        ORDER BY timestamp DESC
        LIMIT 10
      `;
      
      try {
        const recentActivity = await executeQuery(recentActivityQuery);
        stats.recentActivity = recentActivity;
      } catch (error) {
        console.warn('Error fetching recent activity, using empty array');
        stats.recentActivity = [];
      }

      // Get audit log statistics (Phase 13)
      try {
        const auditStatsQuery = `
          SELECT 
            COUNT(*) as total_logs,
            COUNT(CASE WHEN action = 'create' THEN 1 END) as create_actions,
            COUNT(CASE WHEN action = 'update' THEN 1 END) as update_actions,
            COUNT(CASE WHEN action = 'delete' THEN 1 END) as delete_actions,
            COUNT(CASE WHEN action = 'login' THEN 1 END) as login_actions,
            COUNT(CASE WHEN action = 'logout' THEN 1 END) as logout_actions,
            COUNT(CASE WHEN action = 'access' THEN 1 END) as access_actions,
            COUNT(CASE WHEN DATE(timestamp) = CURDATE() THEN 1 END) as logs_today,
            COUNT(CASE WHEN DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as logs_week,
            COUNT(CASE WHEN DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as logs_month
          FROM Audit_Logs
        `;
        
        const [auditStatsRow] = await executeQuery(auditStatsQuery);
        
        const topEntitiesQuery = `
          SELECT 
            target_entity,
            COUNT(*) as count
          FROM Audit_Logs
          WHERE target_entity IS NOT NULL
          GROUP BY target_entity
          ORDER BY count DESC
          LIMIT 5
        `;
        
        const topEntities = await executeQuery(topEntitiesQuery);

        // Get recent critical actions
        const criticalActionsQuery = `
          SELECT 
            al.id,
            al.user_id,
            al.action,
            al.target_entity,
            al.target_id,
            al.timestamp,
            u.full_name as user_name,
            u.email as user_email
          FROM Audit_Logs al
          LEFT JOIN Users u ON al.user_id = u.id
          WHERE 
            al.action = 'delete' OR 
            (al.action = 'update' AND al.target_entity IN ('Users', 'Staff_Members'))
          ORDER BY al.timestamp DESC
          LIMIT 5
        `;
        
        const criticalActions = await executeQuery(criticalActionsQuery);

        // Get recent failed logins (last 24 hours)
        const failedLoginsQuery = `
          SELECT 
            al.id,
            al.user_id,
            al.ip_address,
            al.timestamp,
            al.details_after,
            u.full_name as user_name,
            u.email as user_email
          FROM Audit_Logs al
          LEFT JOIN Users u ON al.user_id = u.id
          WHERE 
            al.action = 'login' AND
            al.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND
            (
              JSON_EXTRACT(al.details_after, '$.success') = false OR
              JSON_EXTRACT(al.details_after, '$.error') IS NOT NULL OR
              al.details_after LIKE '%"success":false%' OR
              al.details_after LIKE '%error%'
            )
          ORDER BY al.timestamp DESC
          LIMIT 10
        `;
        
        const failedLogins = await executeQuery(failedLoginsQuery);
        
        stats.auditLogs = {
          totalLogs: auditStatsRow.total_logs || 0,
          createActions: auditStatsRow.create_actions || 0,
          updateActions: auditStatsRow.update_actions || 0,
          deleteActions: auditStatsRow.delete_actions || 0,
          loginActions: auditStatsRow.login_actions || 0,
          logoutActions: auditStatsRow.logout_actions || 0,
          accessActions: auditStatsRow.access_actions || 0,
          logsToday: auditStatsRow.logs_today || 0,
          logsWeek: auditStatsRow.logs_week || 0,
          logsMonth: auditStatsRow.logs_month || 0,
          topEntities: topEntities,
          criticalActions: criticalActions,
          failedLogins: failedLogins
        };
      } catch (error) {
        console.warn('Audit_Logs table not found, skipping audit log statistics');
        stats.auditLogs = {
          totalLogs: 0,
          createActions: 0,
          updateActions: 0,
          deleteActions: 0,
          loginActions: 0,
          logoutActions: 0,
          accessActions: 0,
          logsToday: 0,
          logsWeek: 0,
          logsMonth: 0,
          topEntities: [],
          criticalActions: [],
          failedLogins: []
        };
      }

      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   * @param {string} period - Time period (week, month, quarter, year)
   * @returns {Object} Revenue analytics data
   */
  static async getRevenueAnalytics(period = 'month') {
    try {
      let dateFilter;
      let groupBy;
      let dateFormat;

      switch (period) {
        case 'week':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
          groupBy = "DATE(created_at)";
          dateFormat = "%Y-%m-%d";
          break;
        case 'quarter':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
          groupBy = "YEAR(created_at), MONTH(created_at)";
          dateFormat = "%Y-%m";
          break;
        case 'year':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
          groupBy = "YEAR(created_at), MONTH(created_at)";
          dateFormat = "%Y-%m";
          break;
        default: // month
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
          groupBy = "DATE(created_at)";
          dateFormat = "%Y-%m-%d";
      }

      const revenueQuery = `
        SELECT 
          DATE_FORMAT(created_at, '${dateFormat}') as date,
          COUNT(*) as payment_count,
          SUM(amount) as total_revenue,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as completed_revenue,
          COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_count
        FROM \`Payments\` 
        WHERE ${dateFilter}
        AND deleted_at IS NULL
        GROUP BY ${groupBy}
        ORDER BY created_at ASC
      `;

      const revenueData = await executeQuery(revenueQuery);
      
      // Transform data for frontend charts
      const chartData = revenueData.map(item => ({
        date: item.date,
        paymentCount: parseInt(item.payment_count),
        totalRevenue: parseFloat(item.total_revenue || 0),
        completedRevenue: parseFloat(item.completed_revenue || 0),
        completedCount: parseInt(item.completed_count)
      }));

      return {
        period,
        data: chartData,
        summary: {
          totalRevenue: chartData.reduce((sum, item) => sum + item.totalRevenue, 0),
          completedRevenue: chartData.reduce((sum, item) => sum + item.completedRevenue, 0),
          totalPayments: chartData.reduce((sum, item) => sum + item.paymentCount, 0),
          completedPayments: chartData.reduce((sum, item) => sum + item.completedCount, 0)
        }
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get user activity analytics
   * @param {string} period - Time period (week, month, quarter, year)
   * @returns {Object} User activity analytics data
   */
  static async getUserActivityAnalytics(period = 'month') {
    try {
      let dateFilter;
      let groupBy;
      let dateFormat;

      switch (period) {
        case 'week':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
          groupBy = "DATE(created_at)";
          dateFormat = "%Y-%m-%d";
          break;
        case 'quarter':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
          groupBy = "YEAR(created_at), MONTH(created_at)";
          dateFormat = "%Y-%m";
          break;
        case 'year':
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
          groupBy = "YEAR(created_at), MONTH(created_at)";
          dateFormat = "%Y-%m";
          break;
        default: // month
          dateFilter = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
          groupBy = "DATE(created_at)";
          dateFormat = "%Y-%m-%d";
      }

      const activityQuery = `
        SELECT 
          DATE_FORMAT(created_at, '${dateFormat}') as date,
          COUNT(*) as total_registrations,
          COUNT(CASE WHEN role = 'patient' THEN 1 END) as patient_registrations,
          COUNT(CASE WHEN role = 'partner' THEN 1 END) as partner_registrations,
          COUNT(CASE WHEN role = 'staff' THEN 1 END) as staff_registrations
        FROM \`Users\` 
        WHERE ${dateFilter}
        AND deleted_at IS NULL
        GROUP BY ${groupBy}
        ORDER BY created_at ASC
      `;

      const activityData = await executeQuery(activityQuery);
      
      // Transform data for frontend charts
      const chartData = activityData.map(item => ({
        date: item.date,
        totalRegistrations: parseInt(item.total_registrations),
        patientRegistrations: parseInt(item.patient_registrations),
        partnerRegistrations: parseInt(item.partner_registrations),
        staffRegistrations: parseInt(item.staff_registrations)
      }));

      return {
        period,
        data: chartData,
        summary: {
          totalRegistrations: chartData.reduce((sum, item) => sum + item.totalRegistrations, 0),
          patientRegistrations: chartData.reduce((sum, item) => sum + item.patientRegistrations, 0),
          partnerRegistrations: chartData.reduce((sum, item) => sum + item.partnerRegistrations, 0),
          staffRegistrations: chartData.reduce((sum, item) => sum + item.staffRegistrations, 0)
        }
      };
    } catch (error) {
      console.error('Error getting user activity analytics:', error);
      throw error;
    }
  }

  /**
   * Get recent activity
   * @param {number} limit - Maximum number of activities to return
   * @returns {Object} Recent activity data
   */
  static async getRecentActivity(limit = 20) {
    try {
      // Reuse the recent activity query from getDashboardStats
      const recentActivityQuery = `
        (
          SELECT 
            'user_registration' as type,
            CONCAT('New user registered: ', full_name) as description,
            created_at as timestamp
          FROM \`Users\` 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND deleted_at IS NULL
        )
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      
      try {
        const recentActivity = await executeQuery(recentActivityQuery, [limit]);
        return {
          activities: recentActivity,
          count: recentActivity.length,
          limit: limit,
          timeWindow: '24 hours'
        };
      } catch (error) {
        console.warn('Error fetching recent activity:', error.message);
        return {
          activities: [],
          count: 0,
          limit: limit,
          timeWindow: '24 hours'
        };
      }
    } catch (error) {
      console.error('Error getting recent activity:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   * @returns {Object} System health data
   */
  static async getSystemHealth() {
    try {
      const health = {};

      // Database connection test
      try {
        await executeQuery('SELECT 1');
        health.database = { status: 'healthy', message: 'Database connection successful' };
      } catch (error) {
        health.database = { status: 'error', message: 'Database connection failed' };
      }

      // Get database size and table stats
      const dbStatsQuery = `
        SELECT 
          table_name,
          table_rows,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        ORDER BY (data_length + index_length) DESC
      `;

      try {
        const dbStats = await executeQuery(dbStatsQuery);
        health.database.tables = dbStats;
        health.database.totalSize = dbStats.reduce((sum, table) => sum + parseFloat(table.size_mb || 0), 0);
      } catch (error) {
        console.error('Error getting database stats:', error);
      }

      // Memory usage (Node.js process)
      const memUsage = process.memoryUsage();
      health.memory = {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      };

      // Server uptime
      health.uptime = {
        seconds: Math.floor(process.uptime()),
        formatted: this._formatUptime(process.uptime())
      };

      return health;
    } catch (error) {
      console.error('Error getting system health:', error);
      throw error;
    }
  }

  /**
   * Format uptime in human readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  static _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

module.exports = AdminService;