-- Migration 016: Add missing columns to Users table
-- This migration adds columns that are referenced in the User.js model but missing from the initial table creation

-- Add missing columns to Users table
ALTER TABLE Users 
ADD COLUMN phone_number VARCHAR(20) NULL COMMENT 'User phone number',
ADD COLUMN date_of_birth DATE NULL COMMENT 'User date of birth',
ADD COLUMN address VARCHAR(500) NULL COMMENT 'User address',
ADD COLUMN emergency_contact VARCHAR(255) NULL COMMENT 'Emergency contact information',
ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL COMMENT 'Whether the user account is active';

-- Add indexes for performance
CREATE INDEX idx_users_is_active ON Users(is_active);
CREATE INDEX idx_users_phone_number ON Users(phone_number);
CREATE INDEX idx_users_date_of_birth ON Users(date_of_birth);

-- Add comments to existing columns for documentation
ALTER TABLE Users MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Primary key';
ALTER TABLE Users MODIFY COLUMN uuid CHAR(36) UNIQUE NOT NULL COMMENT 'Unique identifier for external references';
ALTER TABLE Users MODIFY COLUMN full_name VARCHAR(100) NOT NULL COMMENT 'User full name';
ALTER TABLE Users MODIFY COLUMN email VARCHAR(255) UNIQUE NOT NULL COMMENT 'User email address';
ALTER TABLE Users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password';
ALTER TABLE Users MODIFY COLUMN role ENUM('patient', 'partner', 'staff', 'admin', 'super_admin') NOT NULL COMMENT 'User role in the system';
ALTER TABLE Users MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp';
ALTER TABLE Users MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp';