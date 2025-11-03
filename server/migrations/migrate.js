const fs = require('fs');
const path = require('path');
const { pool, executeTransaction, closePool } = require('../src/config/database');

/**
 * Database Migration Runner with Tracking
 * Handles running SQL migration files in order with proper tracking
 */

// Get command line arguments
const command = process.argv[2];
const migrationName = process.argv[3];

// Migration directory
const MIGRATIONS_DIR = __dirname;

/**
 * Ensure schema_migrations table exists for tracking
 */
async function ensureMigrationsTable() {
  try {
    await executeTransaction(async (connection) => {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          migration_name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_schema_migrations_name (migration_name)
        ) ENGINE=InnoDB COMMENT='Tracks applied database migrations'
      `);
    });
    console.log('✅ Migration tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error.message);
    throw error;
  }
}

/**
 * Get list of applied migrations from database
 * @returns {Array<string>} Array of applied migration names
 */
async function getAppliedMigrations() {
  try {
    const [rows] = await pool.execute(
      'SELECT migration_name FROM schema_migrations ORDER BY applied_at'
    );
    return rows.map(row => row.migration_name);
  } catch (error) {
    console.error('❌ Error getting applied migrations:', error.message);
    throw error;
  }
}

/**
 * Record a migration as applied
 * @param {string} migrationName - Name of the migration file
 */
async function recordMigration(migrationName) {
  try {
    await pool.execute(
      'INSERT INTO schema_migrations (migration_name) VALUES (?)',
      [migrationName]
    );
  } catch (error) {
    console.error(`❌ Error recording migration ${migrationName}:`, error.message);
    throw error;
  }
}

/**
 * Remove migration record (for rollback)
 * @param {string} migrationName - Name of the migration file
 */
async function removeMigrationRecord(migrationName) {
  try {
    await pool.execute(
      'DELETE FROM schema_migrations WHERE migration_name = ?',
      [migrationName]
    );
  } catch (error) {
    console.error(`❌ Error removing migration record ${migrationName}:`, error.message);
    throw error;
  }
}

/**
 * Get all migration files sorted by filename
 * @returns {Array<string>} Array of migration filenames
 */
function getMigrationFiles() {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort by filename (001, 002, etc.)
    
    return files;
  } catch (error) {
    console.error('❌ Error reading migrations directory:', error.message);
    process.exit(1);
  }
}

/**
 * Read SQL file content
 * @param {string} filename - Migration filename
 * @returns {string} SQL content
 */
function readMigrationFile(filename) {
  try {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading migration file ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Execute a single migration file
 * @param {string} filename - Migration filename
 * @param {string} sql - SQL content
 */
async function executeMigration(filename, sql) {
  try {
    console.log(`🔄 Running migration: ${filename}`);
    
    await executeTransaction(async (connection) => {
      // Split SQL by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          await connection.execute(statement);
        }
      }
    });
    
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...\n');
    
    // Ensure migration tracking table exists
    await ensureMigrationsTable();
    
    const migrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    
    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }
    
    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(file => 
      !appliedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date');
      console.log(`📊 Applied migrations: ${appliedMigrations.length}`);
      return;
    }
    
    console.log(`📋 Found ${migrationFiles.length} total migration file(s)`);
    console.log(`✅ Already applied: ${appliedMigrations.length}`);
    console.log(`⏳ Pending: ${pendingMigrations.length}`);
    console.log('\nPending migrations:');
    pendingMigrations.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    // Execute pending migrations in order
    for (const filename of pendingMigrations) {
      const sql = readMigrationFile(filename);
      await executeMigration(filename, sql);
      await recordMigration(filename);
    }
    
    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Migration process failed:', error.message);
    process.exit(1);
  }
}

/**
 * Rollback last migration
 */
async function rollbackMigration() {
  try {
    console.log('🔄 Starting migration rollback...\n');
    
    // Ensure migration tracking table exists
    await ensureMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      console.log('ℹ️  No migrations to rollback');
      return;
    }
    
    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    console.log(`🔄 Rolling back migration: ${lastMigration}`);
    
    // Create rollback SQL by dropping tables in reverse order
    const rollbackSql = generateRollbackSql(lastMigration);
    
    if (rollbackSql) {
      await executeTransaction(async (connection) => {
        const statements = rollbackSql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          if (statement.trim()) {
            console.log(`   Executing: ${statement.substring(0, 50)}...`);
            await connection.execute(statement);
          }
        }
      });
      
      await removeMigrationRecord(lastMigration);
      console.log(`✅ Successfully rolled back: ${lastMigration}`);
    } else {
      console.log(`⚠️  No rollback SQL found for: ${lastMigration}`);
      console.log('💡 Manual rollback may be required');
    }
    
  } catch (error) {
    console.error('\n💥 Rollback failed:', error.message);
    process.exit(1);
  }
}

/**
 * Generate rollback SQL for a migration
 * @param {string} migrationFile - Migration filename
 * @returns {string} Rollback SQL
 */
function generateRollbackSql(migrationFile) {
  // Simple rollback generation - drops tables created in the migration
  const migrationNumber = migrationFile.substring(0, 3);
  
  const rollbackMap = {
    '001': 'DROP TABLE IF EXISTS Users;',
    '002': 'DROP TABLE IF EXISTS Patients;',
    '003': 'DROP TABLE IF EXISTS Partners;',
    '004': 'DROP TABLE IF EXISTS Staff_Members;',
    '005': 'DROP TABLE IF EXISTS Referrals;',
    '006': 'DROP TABLE IF EXISTS Appointments;',
    '007': 'DROP TABLE IF EXISTS Documents;',
    '008': 'DROP TABLE IF EXISTS Services;',
    '009': 'DROP TABLE IF EXISTS Invoices;',
    '010': 'DROP TABLE IF EXISTS Invoice_Items;',
    '011': 'DROP TABLE IF EXISTS Payments;',
    '012': 'DROP TABLE IF EXISTS Staff_Shifts;',
    '013': 'DROP TABLE IF EXISTS External_Entities;',
    '014': 'DROP TABLE IF EXISTS Accounts_Payable;',
    '015': 'DROP TABLE IF EXISTS Audit_Logs;'
  };
  
  return rollbackMap[migrationNumber] || null;
}

/**
 * Create a new migration file
 * @param {string} name - Migration name
 */
function createMigration(name) {
  if (!name) {
    console.error('❌ Migration name is required');
    console.log('Usage: node migrate.js create <migration_name>');
    process.exit(1);
  }
  
  try {
    // Get next migration number
    const existingFiles = getMigrationFiles();
    const lastNumber = existingFiles.length > 0 
      ? parseInt(existingFiles[existingFiles.length - 1].substring(0, 3)) 
      : 0;
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    
    // Create filename
    const filename = `${nextNumber}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(MIGRATIONS_DIR, filename);
    
    // Migration template
    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add description here

-- Drop table if exists (for rollback capability)
-- DROP TABLE IF EXISTS TableName;

-- Create your table or make changes here
-- CREATE TABLE TableName (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Add indexes
-- CREATE INDEX idx_tablename_field ON TableName(field);

-- Add comments
-- ALTER TABLE TableName COMMENT = 'Table description';
`;
    
    fs.writeFileSync(filePath, template);
    console.log(`✅ Created migration file: ${filename}`);
    console.log(`📝 Edit the file to add your migration SQL`);
    
  } catch (error) {
    console.error('❌ Error creating migration file:', error.message);
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  try {
    console.log('📊 Migration Status\n');
    
    const migrationFiles = getMigrationFiles();
    
    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }
    
    console.log('Migration Files:');
    migrationFiles.forEach((file, index) => {
      console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${file}`);
    });
    
    console.log(`\nTotal: ${migrationFiles.length} migration(s)`);
    
  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    switch (command) {
      case 'up':
        await runMigrations();
        break;
        
      case 'down':
        await rollbackMigration();
        break;
        
      case 'create':
        createMigration(migrationName);
        break;
        
      case 'status':
        await showStatus();
        break;
        
      default:
        console.log('WeCare Database Migration Tool\n');
        console.log('Usage:');
        console.log('  node migrate.js up              - Run all pending migrations');
        console.log('  node migrate.js down             - Rollback last migration (not implemented)');
        console.log('  node migrate.js create <name>    - Create new migration file');
        console.log('  node migrate.js status           - Show migration status');
        console.log('\nExamples:');
        console.log('  node migrate.js up');
        console.log('  node migrate.js create add_user_preferences');
        console.log('  node migrate.js status');
        break;
    }
  } catch (error) {
    console.error('❌ Migration tool error:', error.message);
    process.exit(1);
  } finally {
    // Close database connections
    await closePool();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Migration terminated');
  await closePool();
  process.exit(0);
});

// Run the migration tool
main();