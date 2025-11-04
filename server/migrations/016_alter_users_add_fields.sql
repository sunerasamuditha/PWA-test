-- Migration 016: Add missing columns to users table
-- This migration adds columns that are referenced in the User.js model but missing from the initial table creation

-- Conditionally add phone_number column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_number');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add date_of_birth column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'date_of_birth');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN date_of_birth DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add address column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'address');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN address VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add emergency_contact column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'emergency_contact');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add is_active column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add index for is_active if it doesn't exist
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_is_active');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_users_is_active ON users(is_active)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add unique index for uuid if it doesn't exist
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_uuid_unique');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE users ADD UNIQUE INDEX idx_users_uuid_unique (uuid)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Conditionally add unique index for email if it doesn't exist
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_email_unique');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE users ADD UNIQUE INDEX idx_users_email_unique (email)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add comments to columns for documentation (idempotent operations)
ALTER TABLE users MODIFY COLUMN id INT AUTO_INCREMENT COMMENT 'Primary key';
ALTER TABLE users MODIFY COLUMN uuid CHAR(36) NOT NULL COMMENT 'Unique identifier for external references';
ALTER TABLE users MODIFY COLUMN full_name VARCHAR(255) NOT NULL COMMENT 'User full name';
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL COMMENT 'User email address';
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password';
ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL COMMENT 'User role in the system (patient, partner, staff, admin, super_admin)';
ALTER TABLE users MODIFY COLUMN phone_number VARCHAR(20) NULL COMMENT 'User phone number';
ALTER TABLE users MODIFY COLUMN date_of_birth DATE NULL COMMENT 'User date of birth';
ALTER TABLE users MODIFY COLUMN address VARCHAR(500) NULL COMMENT 'User address';
ALTER TABLE users MODIFY COLUMN emergency_contact VARCHAR(255) NULL COMMENT 'Emergency contact information';
ALTER TABLE users MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether the user account is active';
ALTER TABLE users MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp';
ALTER TABLE users MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp';