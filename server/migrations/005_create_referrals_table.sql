-- Migration: Create Referrals table
-- Tracks partner-patient referral relationships for commission tracking
-- Links partners to patients they have referred
-- Created: Phase 1

CREATE TABLE Referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_user_id INT NOT NULL COMMENT 'Partner who made the referral',
    patient_user_id INT NOT NULL COMMENT 'Patient who was referred',
    referred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    commission_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Commission amount for this specific referral',
    
    -- Foreign key constraints
    CONSTRAINT fk_referrals_partner_user_id 
        FOREIGN KEY (partner_user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_referrals_patient_user_id 
        FOREIGN KEY (patient_user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    -- Prevent duplicate referrals from same partner to same patient
    CONSTRAINT uk_referrals_partner_patient 
        UNIQUE (partner_user_id, patient_user_id)
);

-- Indexes for performance
CREATE INDEX idx_referrals_partner_user_id ON Referrals(partner_user_id);
CREATE INDEX idx_referrals_patient_user_id ON Referrals(patient_user_id);
CREATE INDEX idx_referrals_referred_at ON Referrals(referred_at);
CREATE INDEX idx_referrals_commission_amount ON Referrals(commission_amount);

-- Composite indexes for common queries
CREATE INDEX idx_referrals_partner_date ON Referrals(partner_user_id, referred_at);
CREATE INDEX idx_referrals_patient_date ON Referrals(patient_user_id, referred_at);

-- Table comment
ALTER TABLE Referrals COMMENT = 'Tracks partner referrals of patients for commission calculation and relationship mapping';

-- Column comments
ALTER TABLE Referrals 
    MODIFY COLUMN commission_amount DECIMAL(10,2) 
        COMMENT 'Commission amount earned by partner for this referral (calculated based on patient spend)';