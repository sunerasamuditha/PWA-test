const path = require('path');
const app = require('./app'); // Import Express app (no listener)
const { testConnection, closePool } = require('./config/database');
const { startPeriodicCleanup } = require('./utils/cleanupTempFiles');

// Server startup
const PORT = process.env.PORT || 5000;

// Periodic temp file cleanup job
let cleanupInterval = null;

async function startServer() {
  try {
    // Test database connection before starting server
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Server not started.');
      process.exit(1);
    }

    // Start periodic cleanup of temp files (every hour, files older than 24 hours)
    const tempDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'tmp');
    cleanupInterval = startPeriodicCleanup(
      tempDir,
      60 * 60 * 1000,  // Run every hour
      24 * 60 * 60 * 1000  // Delete files older than 24 hours
    );

    // Start the server
    const server = app.listen(PORT, () => {
      console.log('🚀 WeCare PWA Server started successfully');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎨 Frontend URL: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
      }
      
      console.log('📋 Ready to serve requests\n');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      // Stop periodic cleanup
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        console.log('✅ Stopped periodic temp file cleanup');
      }
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ Server closed successfully');
        
        // Close database connections
        closePool().then(() => {
          console.log('👋 Graceful shutdown completed');
          process.exit(0);
        }).catch((dbErr) => {
          console.error('❌ Error closing database:', dbErr);
          process.exit(1);
        });
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after 30 seconds');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('💥 Uncaught Exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly (not imported for tests)
if (require.main === module) {
  startServer();
}

// Export app for testing and server instance for graceful shutdown
module.exports = app;