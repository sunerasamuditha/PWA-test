/**
 * Create test database if it doesn't exist
 * Run this script before tests: node create-test-db.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.test') });
const mysql = require('mysql2/promise');

async function createTestDatabase() {
  let connection;
  
  try {
    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
    });
    
    console.log('✓ Connected to MySQL server');
    
    // Check if database exists
    const dbName = process.env.TEST_DB_NAME || 'wecare_test_db';
    const [databases] = await connection.execute(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    
    if (databases.length > 0) {
      console.log(`✓ Test database '${dbName}' already exists`);
    } else {
      // Create database
      await connection.execute(`CREATE DATABASE ${dbName}`);
      console.log(`✓ Test database '${dbName}' created successfully`);
    }
    
    await connection.end();
    console.log('✓ Setup complete - database ready for testing');
    
  } catch (error) {
    console.error('✗ Failed to create test database:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

createTestDatabase();
