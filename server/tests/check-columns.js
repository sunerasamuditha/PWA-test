require('dotenv').config({ path: '.env.test' });
const mysql = require('mysql2/promise');

async function checkColumns() {
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME
  });

  try {
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users
    `);
    
    console.log('\nAll users table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
    const required = ['is_active', 'date_of_birth', 'address', 'emergency_contact'];
    const missing = required.filter(col => !columns.find(c => c.Field === col));
    
    if (missing.length > 0) {
      console.log('\n❌ Missing columns from migration 016:');
      missing.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log('\n✅ All migration 016 columns exist');
    }
    
  } finally {
    await connection.end();
  }
}

checkColumns().catch(console.error);
