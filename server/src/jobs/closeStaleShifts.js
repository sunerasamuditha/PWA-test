const cron = require('node-cron');
const ShiftService = require('../services/shiftService');

/**
 * Cron job to automatically close stale shifts
 * Uses ShiftService.autoCloseStaleShifts() to find and close shifts
 * 
 * Configuration via environment variables:
 * - SHIFT_AUTOCLOSE_THRESHOLD_HOURS: How many hours before a shift is considered stale (default: 24)
 * - SHIFT_AUTOCLOSE_CRON: Cron schedule expression (default: '0 * * * *' - every hour)
 */
class StaleShiftCloser {
  constructor() {
    this.task = null;
    this.isRunning = false;
    
    // Configuration from environment variables with sensible defaults
    this.thresholdHours = parseInt(process.env.SHIFT_AUTOCLOSE_THRESHOLD_HOURS) || 24;
    this.cronSchedule = process.env.SHIFT_AUTOCLOSE_CRON || '0 * * * *'; // Every hour at minute 0
  }

  /**
   * Initialize and start the cron job
   */
  start() {
    try {
      // Schedule the cron job
      this.task = cron.schedule(this.cronSchedule, async () => {
        await this.run();
      }, {
        scheduled: true,
        timezone: process.env.BUSINESS_TIMEZONE || 'UTC'
      });

      console.log(`🕐 Stale shift auto-close job started`);
      console.log(`   - Schedule: ${this.cronSchedule}`);
      console.log(`   - Threshold: ${this.thresholdHours} hours`);
      console.log(`   - Timezone: ${process.env.BUSINESS_TIMEZONE || 'UTC'}`);
    } catch (error) {
      console.error('❌ Failed to start stale shift auto-close job:', error.message);
    }
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      console.log('🛑 Stale shift auto-close job stopped');
    }
  }

  /**
   * Execute the auto-close job
   */
  async run() {
    if (this.isRunning) {
      console.log('⏭️  Stale shift auto-close job already running, skipping this execution');
      return;
    }

    this.isRunning = true;

    try {
      // Call ShiftService method to handle the logic
      const result = await ShiftService.autoCloseStaleShifts(this.thresholdHours);

      // Log summary if any shifts were closed
      if (result.successfullyClosed > 0) {
        console.log(`\n📧 ${result.successfullyClosed} shift(s) were auto-closed`);
        console.log('   Consider notifying admins about these closures');
      }

      return result;
    } catch (error) {
      console.error('❌ Stale shift auto-close job execution failed:', error.message);
      // Don't throw - let cron continue running
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the job (for testing)
   * @returns {Promise<object>} Job execution result
   */
  async runNow() {
    console.log('🔧 Manually triggering stale shift auto-close job...');
    return await this.run();
  }
}

// Export singleton instance
const staleShiftCloser = new StaleShiftCloser();

module.exports = staleShiftCloser;
