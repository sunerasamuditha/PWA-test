require('dotenv').config({ path: '.env.test' });
const mysql = require('mysql2/promise');

async function checkServices() {
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM services');
    console.log('\nServices table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    const hasCategory = columns.some(c => c.Field === 'category');
    if (!hasCategory) {
      console.log('\n❌ Missing column: category');
      console.log('\nAdding category column...');
      await connection.query(`
        ALTER TABLE services 
        ADD COLUMN category VARCHAR(50) NULL
      `);
      console.log('✅ Added category column');
    } else {
      console.log('\n✅ category column exists');
    }
  } finally {
    await connection.end();
  }
}

checkServices().catch(console.error);
