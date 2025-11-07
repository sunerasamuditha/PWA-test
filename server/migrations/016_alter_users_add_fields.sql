-- Migration 016: Add missing columns to users table
-- This migration adds columns that are referenced in the User.js model but missing from the initial table creation
-- Using a simpler approach without prepared statements for better compatibility

-- Add phone_number column (ignore error if exists)
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL;

-- Add date_of_birth column (ignore error if exists)
ALTER TABLE users ADD COLUMN date_of_birth DATE NULL;

-- Add address column (ignore error if exists)
ALTER TABLE users ADD COLUMN address VARCHAR(500) NULL;

-- Add emergency_contact column (ignore error if exists)
ALTER TABLE users ADD COLUMN emergency_contact VARCHAR(255) NULL;

-- Add is_active column (ignore error if exists)
ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Add index for is_active (ignore error if exists)
CREATE INDEX idx_users_is_active ON users(is_active);