const mysql = require('mysql2/promise');

// Create MySQL connection pool for better performance and connection management
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wecare_db',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  multipleStatements: false, // Security: prevent multiple statement execution
  timezone: 'Z', // Use UTC timezone
});

/**
 * Test database connection
 * @returns {Promise<boolean>} Returns true if connection is successful
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('📊 Database connected successfully');
    
    // Test with a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Database test query successful:', rows[0]);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide specific error messages for common issues
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Make sure MySQL server is running on port', process.env.DB_PORT || 3306);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Tip: Check your database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Tip: Database', process.env.DB_NAME || 'wecare_db', 'does not exist. Create it first.');
    }
    
    return false;
  }
}

/**
 * Execute a query with error handling and logging
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function executeQuery(query, params = []) {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.slice(0, 5), // Log only first 5 params for security
      error: error.message
    });
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - Function containing queries to execute in transaction
 * @returns {Promise<any>} Transaction result
 */
async function executeTransaction(callback) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const result = await callback(connection);
    
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction failed and rolled back:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get database connection statistics safely
 * @returns {Object} Connection pool statistics
 */
async function getConnectionStats() {
  try {
    // Perform a lightweight test query to verify connectivity
    await executeQuery('SELECT 1 as test');
    
    return {
      status: 'connected',
      connectionLimit: pool.config.connectionLimit,
      // Note: Internal pool stats removed for stability across mysql2 versions
      message: 'Database connection healthy'
    };
  } catch (error) {
    return {
      status: 'error',
      connectionLimit: pool.config.connectionLimit,
      message: error.message
    };
  }
}

/**
 * Close all database connections (for graceful shutdown)
 * @returns {Promise<void>}
 */
async function closePool() {
  try {
    await pool.end();
    console.log('📊 Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error.message);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Closing database connections...');
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  testConnection,
  executeQuery,
  executeTransaction,
  getConnectionStats,
  closePool
};