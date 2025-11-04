-- Migration: Create patients table
-- Stores patient-specific information including passport and insurance details
-- Links to Users table with 1:1 relationship
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    passport_info JSON COMMENT 'Passport details: {number, country, expiry_date, issue_date, place_of_issue}',
    insurance_info JSON COMMENT 'Insurance details: {provider, policy_number, coverage_type, expiry_date, contact_info}',
    current_address TEXT COMMENT 'Temporary living address while receiving treatment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_patients_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_created_at ON patients(created_at);

-- Table comment
ALTER TABLE patients COMMENT = 'Patient-specific information including travel documents and insurance';

-- Sample JSON structure comments for reference:
-- passport_info example:
-- {
--   "number": "A12345678",
--   "country": "USA", 
--   "expiry_date": "2030-12-31",
--   "issue_date": "2020-01-01",
--   "place_of_issue": "New York"
-- }

-- insurance_info example:  
-- {
--   "provider": "Global Health Insurance",
--   "policy_number": "GHI123456789",
--   "coverage_type": "Comprehensive",
--   "expiry_date": "2025-12-31",
--   "contact_info": {
--     "phone": "+1-800-555-0123",
--     "email": "claims@globalhealth.com",
--     "emergency_hotline": "+1-800-555-0911"
--   }
-- }