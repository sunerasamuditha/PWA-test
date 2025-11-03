const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

/**
 * Delete a file if it exists (synchronous)
 * @param {string} filePath - Path to file
 */
function deleteFileSync(filePath) {
  try {
    if (fsSync.existsSync(filePath)) {
      fsSync.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error.message);
  }
}

/**
 * Clean up temp files older than specified age
 * @param {string} tempDir - Path to temp directory
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {Promise<number>} Number of files deleted
 */
async function cleanOldTempFiles(tempDir, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const tempPath = path.resolve(tempDir);
    
    if (!fsSync.existsSync(tempPath)) {
      return 0;
    }

    const files = await fs.readdir(tempPath);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempPath, file);
      try {
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAgeMs) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`Deleted old temp file: ${filePath} (age: ${Math.round(fileAge / 1000 / 60)} minutes)`);
        }
      } catch (error) {
        console.error(`Error processing temp file ${filePath}:`, error.message);
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old temp files from ${tempPath}`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning temp files:', error.message);
    return 0;
  }
}

/**
 * Middleware to cleanup file on request abort
 * Attach to routes with file uploads to prevent orphaned temp files
 */
function cleanupOnAbort(req, res, next) {
  req.on('aborted', () => {
    if (req.file?.path) {
      console.warn(`Request aborted, cleaning up temp file: ${req.file.path}`);
      deleteFileSync(req.file.path);
    }
  });
  
  next();
}

/**
 * Start periodic cleanup job for temp directory
 * @param {string} tempDir - Path to temp directory
 * @param {number} intervalMs - Cleanup interval in milliseconds
 * @param {number} maxAgeMs - Maximum file age in milliseconds
 * @returns {NodeJS.Timeout} Interval handle
 */
function startPeriodicCleanup(tempDir, intervalMs = 60 * 60 * 1000, maxAgeMs = 24 * 60 * 60 * 1000) {
  console.log(`Starting periodic temp file cleanup: every ${intervalMs / 1000 / 60} minutes, files older than ${maxAgeMs / 1000 / 60 / 60} hours`);
  
  // Run immediately on start
  cleanOldTempFiles(tempDir, maxAgeMs).catch(err => 
    console.error('Initial temp cleanup failed:', err)
  );

  // Schedule periodic cleanup
  return setInterval(() => {
    cleanOldTempFiles(tempDir, maxAgeMs).catch(err =>
      console.error('Periodic temp cleanup failed:', err)
    );
  }, intervalMs);
}

module.exports = {
  deleteFileSync,
  cleanOldTempFiles,
  cleanupOnAbort,
  startPeriodicCleanup
};
