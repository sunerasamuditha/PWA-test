require('dotenv').config({ path: '.env.test' });
const mysql = require('mysql2/promise');

async function forceMigration() {
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME,
    multipleStatements: true
  });

  try {
    // Check and add each column individually
    const columns = [
      { name: 'date_of_birth', sql: 'ALTER TABLE users ADD COLUMN date_of_birth DATE NULL' },
      { name: 'address', sql: 'ALTER TABLE users ADD COLUMN address VARCHAR(500) NULL' },
      { name: 'emergency_contact', sql: 'ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(255) NULL' },
      { name: 'is_active', sql: 'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1' }
    ];

    for (const col of columns) {
      try {
        await connection.query(col.sql);
        console.log(`✓ Added column: ${col.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠ Column already exists: ${col.name}`);
        } else {
          console.log(`❌ Error adding ${col.name}:`, error.message);
        }
      }
    }

    // Add index
    try {
      await connection.query('CREATE INDEX idx_users_is_active ON users(is_active)');
      console.log('✓ Added index: idx_users_is_active');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠ Index already exists: idx_users_is_active');
      } else {
        console.log('❌ Error adding index:', error.message);
      }
    }

    // Verify
    const [columns2] = await connection.query('SHOW COLUMNS FROM users');
    console.log('\n✅ Final users table columns:');
    columns2.forEach(col => console.log(`  - ${col.Field}`));
    
  } finally {
    await connection.end();
  }
}

forceMigration().catch(console.error);
