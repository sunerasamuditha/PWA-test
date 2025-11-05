const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const { createAuditLog } = require('../middleware/auditLog');

/**
 * Cron job to automatically close stale shifts
 * Runs every hour to check for shifts that are still open but older than 24 hours
 * 
 * Schedule: Every hour at minute 0 (0 * * * *)
 */
class StaleShiftCloser {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  /**
   * Initialize and start the cron job
   */
  start() {
    // Run every hour at the top of the hour
    this.task = cron.schedule('0 * * * *', async () => {
      await this.closeStaleShifts();
    }, {
      scheduled: true,
      timezone: 'UTC' // Use UTC for cron scheduling consistency
    });

    console.log('🕐 Stale shift closer cron job started (runs every hour)');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      console.log('🛑 Stale shift closer cron job stopped');
    }
  }

  /**
   * Main method to find and close stale shifts
   */
  async closeStaleShifts() {
    if (this.isRunning) {
      console.log('⏭️  Stale shift closer already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      console.log(`\n🔍 [${startTime.toISOString()}] Checking for stale shifts...`);

      // Find all shifts that are:
      // 1. Still active (logout_at IS NULL)
      // 2. login_at is older than 24 hours
      const staleShifts = await executeQuery(
        `SELECT 
          ss.id,
          ss.staff_user_id,
          ss.login_at,
          ss.shift_type,
          u.full_name,
          u.email
        FROM staff_shifts ss
        JOIN users u ON ss.staff_user_id = u.id
        WHERE ss.logout_at IS NULL
        AND ss.login_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY ss.login_at ASC`
      );

      if (!staleShifts || staleShifts.length === 0) {
        console.log('✅ No stale shifts found');
        this.isRunning = false;
        return;
      }

      console.log(`⚠️  Found ${staleShifts.length} stale shift(s) to close`);

      let closedCount = 0;
      let failedCount = 0;
      const errors = [];

      // Process each stale shift
      for (const shift of staleShifts) {
        try {
          // Set logout_at to 24 hours after login_at as a reasonable cutoff
          const autoCutoffTime = new Date(shift.login_at);
          autoCutoffTime.setHours(autoCutoffTime.getHours() + 24);

          // Calculate total hours (should be exactly 24 for auto-closed shifts)
          const result = await executeQuery(
            `UPDATE staff_shifts 
            SET 
              logout_at = ?,
              total_hours = TIMESTAMPDIFF(HOUR, login_at, ?),
              notes = CONCAT(
                COALESCE(notes, ''), 
                IF(notes IS NULL OR notes = '', '', '\n'),
                'Auto-closed by system: shift exceeded 24 hours'
              ),
              updated_at = NOW()
            WHERE id = ?`,
            [autoCutoffTime, autoCutoffTime, shift.id]
          );

          if (result.affectedRows > 0) {
            closedCount++;

            console.log(`  ✓ Closed shift #${shift.id} for ${shift.full_name} (logged in at ${shift.login_at})`);

            // Create audit log for automatic closure
            try {
              await createAuditLog({
                userId: null, // System action, no user
                action: 'SHIFT_AUTO_CLOSED',
                resourceType: 'shift',
                resourceId: shift.id,
                details: {
                  staff_user_id: shift.staff_user_id,
                  staff_name: shift.full_name,
                  staff_email: shift.email,
                  login_at: shift.login_at,
                  logout_at: autoCutoffTime,
                  shift_type: shift.shift_type,
                  reason: 'Shift exceeded 24 hours without logout',
                  total_hours: 24
                },
                ipAddress: 'SYSTEM',
                userAgent: 'Cron Job - Stale Shift Closer'
              });
            } catch (auditError) {
              console.warn(`  ⚠️  Failed to create audit log for shift #${shift.id}:`, auditError.message);
            }
          }
        } catch (error) {
          failedCount++;
          errors.push({
            shiftId: shift.id,
            staffName: shift.full_name,
            error: error.message
          });
          console.error(`  ✗ Failed to close shift #${shift.id}:`, error.message);
        }
      }

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      console.log(`\n📊 Stale shift closer summary:`);
      console.log(`  - Total found: ${staleShifts.length}`);
      console.log(`  - Successfully closed: ${closedCount}`);
      console.log(`  - Failed: ${failedCount}`);
      console.log(`  - Duration: ${duration.toFixed(2)}s`);

      if (errors.length > 0) {
        console.error(`\n❌ Errors encountered:`);
        errors.forEach(err => {
          console.error(`  - Shift #${err.shiftId} (${err.staffName}): ${err.error}`);
        });
      }

      // TODO: Send notification to admins if shifts were auto-closed
      if (closedCount > 0) {
        console.log(`\n📧 TODO: Send notification to admins about ${closedCount} auto-closed shift(s)`);
      }

    } catch (error) {
      console.error('❌ Stale shift closer job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the job (for testing)
   */
  async runNow() {
    console.log('🔧 Manually triggering stale shift closer...');
    await this.closeStaleShifts();
  }
}

// Export singleton instance
const staleShiftCloser = new StaleShiftCloser();

module.exports = staleShiftCloser;
