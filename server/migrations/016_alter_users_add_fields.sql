-- Migration 016: Add missing columns to users table
-- This migration adds columns that are referenced in the User.js model but missing from the initial table creation

-- Add missing columns if they don't already exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Add index for is_active for performance
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add comments to columns for documentation
ALTER TABLE users MODIFY COLUMN id INT AUTO_INCREMENT COMMENT 'Primary key';
ALTER TABLE users MODIFY COLUMN uuid CHAR(36) UNIQUE NOT NULL COMMENT 'Unique identifier for external references';
ALTER TABLE users MODIFY COLUMN full_name VARCHAR(255) NOT NULL COMMENT 'User full name';
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) UNIQUE NOT NULL COMMENT 'User email address';
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password';
ALTER TABLE users MODIFY COLUMN role ENUM('patient', 'partner', 'staff', 'admin', 'super_admin') NOT NULL COMMENT 'User role in the system';
ALTER TABLE users MODIFY COLUMN phone_number VARCHAR(20) NULL COMMENT 'User phone number';
ALTER TABLE users MODIFY COLUMN date_of_birth DATE NULL COMMENT 'User date of birth';
ALTER TABLE users MODIFY COLUMN address VARCHAR(500) NULL COMMENT 'User address';
ALTER TABLE users MODIFY COLUMN emergency_contact VARCHAR(255) NULL COMMENT 'Emergency contact information';
ALTER TABLE users MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether the user account is active';
ALTER TABLE users MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp';
ALTER TABLE users MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp';