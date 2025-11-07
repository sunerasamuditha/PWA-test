require('dotenv').config({ path: '.env.test' });
const mysql = require('mysql2/promise');

async function checkAuditLogs() {
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM audit_logs');
    console.log('\naudit_logs table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
  } finally {
    await connection.end();
  }
}

checkAuditLogs().catch(console.error);
