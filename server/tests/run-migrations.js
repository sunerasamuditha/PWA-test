/**
 * Run migrations manually to test
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.test') });
const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');

async function runMigrations() {
  const migrationDir = path.join(__dirname, '../migrations');
  
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT) || 3306,
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME || 'wecare_test_db',
    multipleStatements: true,
  });
  
  try {
    const files = await fs.readdir(migrationDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    console.log(`Running ${sqlFiles.length} migrations...`);
    
    for (const file of sqlFiles) {
      const filePath = path.join(migrationDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');
      
      try {
        await connection.query(sql);
        console.log(`  ✓ ${file}`);
      } catch (error) {
        const ignorableErrors = [
          'Duplicate key name',
          'already exists',
          'Multiple primary key defined',
          'Duplicate column name',
          'Can\'t DROP',
          'Duplicate index'
        ];
        
        const isIgnorable = ignorableErrors.some(msg => error.message.includes(msg));
        
        if (isIgnorable) {
          console.log(`  ⚠ ${file} (skipped - already applied)`);
          continue;
        }
        
        console.error(`  ✗ ${file} failed:`);
        console.error(`    Error: ${error.message}`);
      }
    }
    
    await connection.end();
    console.log('\nMigrations completed!');
    
    // Check if phone_number column exists
    const checkConnection = await mysql.createConnection({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT) || 3306,
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || '',
      database: process.env.TEST_DB_NAME || 'wecare_test_db',
    });
    
    const [columns] = await checkConnection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [process.env.TEST_DB_NAME || 'wecare_test_db']
    );
    
    console.log('\nUsers table columns:');
    columns.forEach(col => console.log(`  - ${col.COLUMN_NAME}`));
    
    const hasPhoneNumber = columns.some(col => col.COLUMN_NAME === 'phone_number');
    console.log(`\n${hasPhoneNumber ? '✓' : '✗'} phone_number column ${hasPhoneNumber ? 'EXISTS' : 'MISSING'}`);
    
    await checkConnection.end();
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
