// Load test environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '.env.test') });

// Configure test-specific upload directory BEFORE any imports
// This ensures multer config reads the correct UPLOAD_DIR
process.env.UPLOAD_DIR = require('path').join(__dirname, '../uploads/test');
process.env.NODE_ENV = 'test';

// Set default ENCRYPTION_KEY for tests if not provided
// This is a 32-byte (64 hex characters) key for AES-256 encryption
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  console.warn('⚠️  Using default test ENCRYPTION_KEY');
}

// CRITICAL: Set test database environment variables BEFORE requiring database module
// This ensures the connection pool binds to the test database, not production
if (process.env.TEST_DB_NAME) {
  process.env.DB_NAME = process.env.TEST_DB_NAME;
}
if (process.env.TEST_DB_HOST) {
  process.env.DB_HOST = process.env.TEST_DB_HOST;
}
if (process.env.TEST_DB_USER) {
  process.env.DB_USER = process.env.TEST_DB_USER;
}
if (process.env.TEST_DB_PASSWORD) {
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD;
}
if (process.env.TEST_DB_PORT) {
  process.env.DB_PORT = process.env.TEST_DB_PORT;
}

// Fallback: Use 'wecare_test_db' if no explicit test DB name provided
if (!process.env.DB_NAME || process.env.DB_NAME === 'wecare_db') {
  process.env.DB_NAME = 'wecare_test_db';
  console.warn('⚠️  Using default test database: wecare_test_db');
}

// NOW require the database module - it will use the test DB config
const { executeQuery, pool } = require('../src/config/database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Test Database Configuration
 * Separate database for testing to avoid affecting development/production data
 * NOTE: DB_NAME is now overridden above before requiring the database module
 */
const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // Now guaranteed to be test DB
  port: process.env.DB_PORT || 3306
};

/**
 * Parse SQL statements from migration file
 * Handles comments, multi-line statements, DELIMITER syntax, and PREPARE/EXECUTE blocks
 */
function parseSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDelimiterBlock = false;
  let customDelimiter = ';';
  let inPrepareBlock = false;
  
  // Split by lines to handle DELIMITER commands and comments
  const lines = sql.split('\n');
  
  for (let line of lines) {
    // Remove inline comments (-- style)
    const commentIndex = line.indexOf('--');
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    
    // Trim whitespace
    line = line.trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Handle DELIMITER command
    if (line.toUpperCase().startsWith('DELIMITER')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        customDelimiter = parts[1];
        inDelimiterBlock = customDelimiter !== ';';
      }
      continue;
    }
    
    // Track PREPARE blocks (need to include EXECUTE and DEALLOCATE as one unit)
    if (line.toUpperCase().includes('PREPARE')) {
      inPrepareBlock = true;
    }
    
    // Build current statement
    currentStatement += (currentStatement ? '\n' : '') + line;
    
    // Check if statement is complete
    const shouldEnd = currentStatement.trimEnd().endsWith(customDelimiter);
    
    if (shouldEnd) {
      // If in PREPARE block, wait for DEALLOCATE PREPARE before ending
      if (inPrepareBlock && !line.toUpperCase().includes('DEALLOCATE')) {
        continue;
      }
      
      // Remove delimiter and add to statements array
      const statement = currentStatement
        .substring(0, currentStatement.lastIndexOf(customDelimiter))
        .trim();
      
      if (statement) {
        statements.push(statement);
      }
      
      currentStatement = '';
      inPrepareBlock = false;
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements;
}

/**
 * Migration lock to prevent parallel migration runs
 */
let migrationPromise = null;
let migrationCompleted = false;

/**
 * Run database migrations
 * Enhanced to handle complex SQL including DELIMITER blocks and multi-line statements
 * Skips errors for already existing objects (idempotent)
 * Uses singleton pattern to prevent parallel execution
 */
async function runMigrations() {
  // If migrations already completed, skip
  if (migrationCompleted) {
    return;
  }
  
  // If migrations are currently running, wait for them to complete
  if (migrationPromise) {
    return migrationPromise;
  }
  
  // Create the migration promise
  migrationPromise = (async () => {
    const migrationDir = path.join(__dirname, '../migrations');
    const mysql = require('mysql2/promise');
    
    // Create a separate connection for migrations with multipleStatements enabled
    const migrationConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      multipleStatements: true, // Enable for PREPARE/EXECUTE blocks
    });
  
  try {
    const files = await fs.readdir(migrationDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    console.log(`Running ${sqlFiles.length} migrations...`);
    
    for (const file of sqlFiles) {
      const filePath = path.join(migrationDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');
      
      try {
        // Execute entire migration file as-is
        await migrationConnection.query(sql);
        console.log(`  ✓ ${file}`);
      } catch (error) {
        // Ignore errors for already existing objects (idempotent migrations)
        const ignorableErrors = [
          'Duplicate key name',
          'already exists',
          'Multiple primary key defined',
          'Duplicate column name',
          'Can\'t DROP',
          'Duplicate index',
          'ER_TABLE_EXISTS_ERROR',
          'ER_DUP_KEYNAME',
          'ER_DUP_FIELDNAME'
        ];
        
        const isIgnorable = ignorableErrors.some(msg => 
          error.message.includes(msg) || error.code === msg
        );
        
        if (isIgnorable) {
          console.log(`  ⚠ ${file} (skipped - already applied)`);
          // CONTINUE to next file instead of throwing
          continue;
        }
        
        console.error(`  ✗ ${file} failed:`);
        console.error(`    Error: ${error.message}`);
        console.error(`    Code: ${error.code}`);
        // Don't throw - continue with other migrations
        // throw error;
      }
    }
    
    await migrationConnection.end();
    console.log('Migrations completed');
    migrationCompleted = true; // Mark as completed
  } catch (error) {
    if (migrationConnection) {
      await migrationConnection.end();
    }
    console.error('Migration process error:', error);
    migrationCompleted = true; // Mark as completed even on error to prevent retries
    // Don't throw - allow tests to proceed
    // throw error;
  }
  })(); // End of async IIFE
  
  return migrationPromise;
}

/**
 * Global test setup
 * Runs once before all tests
 */
/**
 * Check if core tables exist in the database
 * @returns {Promise<boolean>} True if tables exist
 */
async function checkTablesExist() {
  try {
    const [tables] = await pool.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'Users'",
      [process.env.DB_NAME]
    );
    return tables[0].count > 0;
  } catch (error) {
    return false;
  }
}

beforeAll(async () => {
  console.log('Setting up test environment...');
  
  try {
    // Connect to test database
    console.log(`Connecting to test database: ${TEST_DB_CONFIG.database}`);
    
    // Auto-run migrations for test environment
    // Check if migrations should run:
    // 1. Explicitly enabled via RUN_MIGRATIONS=true
    // 2. Auto-detect: Core tables don't exist (fresh DB)
    // 3. Default for NODE_ENV=test (implicit)
    const shouldRunMigrations = 
      process.env.RUN_MIGRATIONS === 'true' || 
      !(await checkTablesExist());
    
    if (shouldRunMigrations) {
      console.log('Running migrations (auto-detected or explicitly enabled)...');
      await runMigrations();
    } else {
      console.log('Skipping migrations (tables exist and RUN_MIGRATIONS not set)');
    }
    
    // Optional: Seed test data (disabled by default to reduce flakiness)
    // Enable with SEED_TEST_DATA=true for local exploratory runs
    if (process.env.SEED_TEST_DATA === 'true') {
      console.log('Seeding test data...');
      const { seed } = require('./seed-data');
      await seed();
    } else {
      console.log('Skipping seed data (each test creates its own fixtures)');
    }
    
    console.log('Test environment setup complete');
  } catch (error) {
    console.error('Failed to set up test environment:', error);
    throw error;
  }
});

/**
 * Global test teardown
 * Runs once after all tests
 */
afterAll(async () => {
  console.log('Tearing down test environment...');
  
  try {
    // Clean up uploaded test files
    await cleanupTestFiles();
    
    // Truncate all tables (preserve schema)
    await truncateAllTables();
    
    // Close database connections
    if (pool) {
      await pool.end();
    }
    
    console.log('Test environment teardown complete');
  } catch (error) {
    console.error('Failed to tear down test environment:', error);
    throw error;
  }
});

/**
 * Test isolation
 * Runs before each test (optional, for transaction-based isolation)
 */
beforeEach(async () => {
  // Optional: Start transaction for test isolation
  // await executeQuery('START TRANSACTION');
});

/**
 * Test cleanup
 * Runs after each test
 */
afterEach(async () => {
  // Optional: Rollback transaction for test isolation
  // await executeQuery('ROLLBACK');
});

/**
 * Test Utilities
 */

// Track uploaded files for cleanup
const uploadedTestFiles = [];

/**
 * Register a file for cleanup after tests
 * @param {string} filePath - Absolute or relative file path
 */
function trackTestFile(filePath) {
  uploadedTestFiles.push(filePath);
}

/**
 * Create a test user with specified role
 * @param {string} role - User role (patient, partner, staff, admin, super_admin)
 * @param {Object} additionalData - Additional user data
 * @returns {Object} Created user with tokens
 */
async function createTestUser(role = 'patient', additionalData = {}) {
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  
  // Generate truly unique email using timestamp + random string
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const defaultData = {
    email: `test_${role}_${uniqueId}@test.com`,
    password_hash: await bcrypt.hash('Test@123', 10),
    full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    phone_number: `${Math.floor(Math.random() * 9000000000) + 1000000000}`, // Random 10-digit phone
    role: role,
    is_active: true
  };
  
  // If additionalData has an email, make it unique by appending uniqueId
  const userData = { ...defaultData, ...additionalData };
  if (additionalData.email && !additionalData.email.includes('_unique_')) {
    // Append unique ID to prevent collisions while keeping test-friendly names
    const emailParts = additionalData.email.split('@');
    userData.email = `${emailParts[0]}_unique_${uniqueId}@${emailParts[1]}`;
  }
  
  const query = `
    INSERT INTO Users (email, password_hash, full_name, phone_number, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  // executeQuery returns rows directly (already destructured in database.js)
  const result = await executeQuery(query, [
    userData.email,
    userData.password_hash,
    userData.full_name,
    userData.phone_number,
    userData.role,
    userData.is_active
  ]);
  
  const userId = result.insertId;
  
  // Fetch the created user to get the UUID (generated by database)
  const userRows = await executeQuery('SELECT uuid FROM Users WHERE id = ?', [userId]);
  const uuid = userRows[0].uuid;
  
  // Generate tokens (matching server JWT format)
  const accessToken = jwt.sign(
    { id: userId, email: userData.email, role: userData.role, uuid: uuid, type: 'access' },
    process.env.JWT_SECRET || 'test_secret',
    { 
      expiresIn: '1h',
      issuer: 'wecare-api',
      audience: 'wecare-client'
    }
  );
  
  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_SECRET || 'test_secret',
    { 
      expiresIn: '7d',
      issuer: 'wecare-api',
      audience: 'wecare-client'
    }
  );
  
  return {
    id: userId,
    uuid: uuid,
    ...userData,
    accessToken,
    refreshToken
  };
}

/**
 * Create a test patient (user + patient record)
 * @param {Object} userData - User data
 * @param {Object} patientData - Patient data
 * @returns {Object} Created patient
 */
async function createTestPatient(userData = {}, patientData = {}) {
  const user = await createTestUser('patient', userData);
  
  const defaultPatientData = {
    user_id: user.id,
    current_address: '123 Test Street, Test City',
    passport_info: JSON.stringify({
      number: 'P123456789',
      country: 'USA',
      expiryDate: '2030-12-31'
    }),
    insurance_info: JSON.stringify({
      provider: 'Test Insurance Co',
      policyNumber: 'INS123456',
      coverageType: 'comprehensive'
    })
  };
  
  const patient = { ...defaultPatientData, ...patientData };
  
  const query = `
    INSERT INTO Patients (user_id, current_address, passport_info, insurance_info)
    VALUES (?, ?, ?, ?)
  `;
  
  await executeQuery(query, [
    patient.user_id,
    patient.current_address,
    patient.passport_info,
    patient.insurance_info
  ]);
  
  return { user, patient };
}

/**
 * Create a test partner (user + partner record)
 * @param {Object} userData - User data
 * @param {Object} partnerData - Partner data
 * @returns {Object} Created partner
 */
async function createTestPartner(userData = {}, partnerData = {}) {
  const user = await createTestUser('partner', userData);
  
  const defaultPartnerData = {
    user_id: user.id,
    type: 'guide', // Fixed: column is 'type' not 'partner_type'
    status: 'active',
    commission_points: 0.00
  };
  
  const partner = { ...defaultPartnerData, ...partnerData };
  
  const query = `
    INSERT INTO Partners (user_id, type, status, commission_points)
    VALUES (?, ?, ?, ?)
  `;
  
  await executeQuery(query, [
    partner.user_id,
    partner.type,
    partner.status,
    partner.commission_points
  ]);
  
  return { user, partner };
}

/**
 * Create a test staff member (user + staff record)
 * @param {Object} userData - User data
 * @param {Object} staffData - Staff data
 * @returns {Object} Created staff
 */
async function createTestStaff(userData = {}, staffData = {}) {
  const user = await createTestUser('staff', userData);
  
  const defaultStaffData = {
    user_id: user.id,
    staff_role: 'front_desk',
    permissions: JSON.stringify(['manage_appointments', 'manage_documents'])
  };
  
  const staff = { ...defaultStaffData, ...staffData };
  
  const query = `
    INSERT INTO Staff_Members (user_id, staff_role, permissions)
    VALUES (?, ?, ?)
  `;
  
  await executeQuery(query, [
    staff.user_id,
    staff.staff_role,
    staff.permissions
  ]);
  
  return { user, staff };
}

/**
 * Create a test appointment
 * @param {number} patientUserId - Patient user ID
 * @param {Object} appointmentData - Appointment data
 * @returns {Object} Created appointment
 */
async function createTestAppointment(patientUserId, appointmentData = {}) {
  const defaultData = {
    patient_user_id: patientUserId,
    appointment_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    type: 'opd',
    status: 'scheduled',
    notes: 'Test appointment'
  };
  
  const appointment = { ...defaultData, ...appointmentData };
  
  const query = `
    INSERT INTO Appointments (patient_user_id, appointment_datetime, type, status, notes)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const result = await executeQuery(query, [
    appointment.patient_user_id,
    appointment.appointment_datetime,
    appointment.type,
    appointment.status,
    appointment.notes
  ]);
  
  return { id: result.insertId, ...appointment };
}

/**
 * Create a test invoice with items
 * @param {number} patientUserId - Patient user ID
 * @param {Array} items - Invoice items
 * @returns {Object} Created invoice
 */
async function createTestInvoice(patientUserId, items = []) {
  // Use the server's invoice number generator utility for atomicity
  const { generateInvoiceNumber } = require('../src/utils/invoiceNumberGenerator');
  const invoiceNumber = await generateInvoiceNumber();
  
  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  
  // Insert invoice
  const invoiceQuery = `
    INSERT INTO Invoices (invoice_number, patient_user_id, total_amount, status, invoice_type, payment_method)
    VALUES (?, ?, ?, 'pending', 'opd', 'cash')
  `;
  
  const invoiceResult = await executeQuery(invoiceQuery, [
    invoiceNumber,
    patientUserId,
    totalAmount
  ]);
  
  const invoiceId = invoiceResult.insertId;
  
  // Insert invoice items
  for (const item of items) {
    const itemQuery = `
      INSERT INTO Invoice_Items (invoice_id, service_id, description, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await executeQuery(itemQuery, [
      invoiceId,
      item.service_id || null,
      item.description || 'Test service',
      item.quantity,
      item.unit_price,
      item.quantity * item.unit_price
    ]);
  }
  
  return { id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount, items };
}

/**
 * Create a test document record (without actual file)
 * @param {number} patientUserId - Patient user ID
 * @param {Object} documentData - Document data
 * @returns {Object} Created document
 */
async function createTestDocument(patientUserId, documentData = {}) {
  const defaultData = {
    patient_user_id: patientUserId,
    type: 'passport',
    file_path: `/uploads/${patientUserId}/test-document.pdf`,
    original_filename: 'test-document.pdf',
    file_size: 12345,
    mime_type: 'application/pdf'
  };
  
  const document = { ...defaultData, ...documentData };
  
  const query = `
    INSERT INTO Documents (patient_user_id, type, file_path, original_filename, file_size, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const result = await executeQuery(query, [
    document.patient_user_id,
    document.type,
    document.file_path,
    document.original_filename,
    document.file_size,
    document.mime_type
  ]);
  
  return { id: result.insertId, ...document };
}

/**
 * Authentication Helpers
 */

/**
 * Get auth token for user ID
 * @param {number} userId - User ID
 * @returns {string} JWT token
 */
function getAuthToken(userId) {
  const jwt = require('jsonwebtoken');
  
  // Get user from database
  const getUserQuery = `SELECT id, email, role FROM Users WHERE id = ?`;
  
  return executeQuery(getUserQuery, [userId]).then((rows) => {
    if (rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }
    
    const user = rows[0];
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, type: 'access' },
      process.env.JWT_SECRET || 'test_secret',
      { 
        expiresIn: '1h',
        issuer: 'wecare-api',
        audience: 'wecare-client'
      }
    );
  });
}

/**
 * Get admin token
 * @returns {string} Admin JWT token
 */
async function getAdminToken() {
  const admin = await createTestUser('admin');
  return admin.accessToken;
}

/**
 * Get patient token
 * @returns {string} Patient JWT token
 */
async function getPatientToken() {
  const { user } = await createTestPatient();
  return user.accessToken;
}

/**
 * Cleanup Helpers
 */

/**
 * Clean up uploaded test files
 */
async function cleanupTestFiles() {
  // Only run cleanup in test environment for safety
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Skipping file cleanup - not in test environment');
    return;
  }

  // Clean up tracked files
  for (const filePath of uploadedTestFiles) {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(__dirname, '../..', filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      // File may not exist, ignore
    }
  }
  uploadedTestFiles.length = 0;
  
  // Clean up test upload directory completely
  const testUploadsDir = path.join(__dirname, '../uploads/test');
  
  try {
    // Check if directory exists
    await fs.access(testUploadsDir);
    
    // Delete entire test uploads directory recursively
    await fs.rm(testUploadsDir, { recursive: true, force: true });
    
    console.log('✓ Cleaned up test uploads directory');
  } catch (error) {
    // Directory doesn't exist or other error - ignore
    if (error.code !== 'ENOENT') {
      console.warn('Could not clean up test files:', error.message);
    }
  }
}

/**
 * Truncate a specific table
 * @param {string} tableName - Table name
 */
async function truncateTable(tableName) {
  try {
    // Disable foreign key checks, truncate, and re-enable in one go
    await executeQuery('SET FOREIGN_KEY_CHECKS = 0');
    await executeQuery(`TRUNCATE TABLE ${tableName}`);
  } catch (error) {
    // If TRUNCATE fails, try DELETE
    console.warn(`TRUNCATE failed for ${tableName}, using DELETE: ${error.message}`);
    try {
      await executeQuery(`DELETE FROM ${tableName}`);
    } catch (deleteError) {
      console.error(`Failed to clean ${tableName}:`, deleteError.message);
    }
  } finally {
    // Always re-enable foreign key checks
    await executeQuery('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/**
 * Truncate all tables and reset database
 */
async function truncateAllTables() {
  const tables = [
    'Audit_Logs',
    'Push_Subscriptions',
    'Accounts_Payable',
    'External_Entities',
    'Staff_Shifts',
    'Payments',
    'Invoice_Items',
    'Invoices',
    'Invoice_Sequences', // Add invoice sequences table for concurrency tests
    'Services',
    'Documents',
    'Appointments',
    'Referrals',
    'Staff_Members',
    'Partners',
    'Patients',
    'Users'
  ];
  
  // Single FK check toggle for all truncations (optimized)
  await executeQuery('SET FOREIGN_KEY_CHECKS = 0');
  
  // Truncate all tables in parallel
  await Promise.all(
    tables.map(table => 
      executeQuery(`TRUNCATE TABLE ${table}`).catch(error => {
        console.warn(`Could not truncate ${table}:`, error.message);
      })
    )
  );
  
  await executeQuery('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * Reset database to clean state
 */
async function resetDatabase() {
  await truncateAllTables();
  await cleanupTestFiles();
}

/**
 * Export test utilities
 */
module.exports = {
  TEST_DB_CONFIG,
  executeQuery, // Export executeQuery for direct DB assertions in tests
  createTestUser,
  createTestPatient,
  createTestPartner,
  createTestStaff,
  createTestAppointment,
  createTestInvoice,
  createTestDocument,
  trackTestFile, // Export for tracking uploaded files
  getAuthToken,
  getAdminToken,
  getPatientToken,
  cleanupTestFiles,
  truncateTable,
  truncateAllTables,
  resetDatabase
};
