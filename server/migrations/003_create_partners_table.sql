-- Migration: Create Partners table
-- Stores referral partners information (guides, drivers, hotels, etc.)
-- Links to Users table with 1:1 relationship
-- Created: Phase 1

CREATE TABLE Partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    type ENUM('guide', 'driver', 'hotel', 'villa', 'guest_house', 'other') NOT NULL,
    status ENUM('pending', 'active', 'inactive') DEFAULT 'pending',
    commission_points DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total commission points earned from referrals',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_partners_user_id 
        FOREIGN KEY (user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_partners_user_id ON Partners(user_id);
CREATE INDEX idx_partners_type ON Partners(type);
CREATE INDEX idx_partners_status ON Partners(status);
CREATE INDEX idx_partners_commission_points ON Partners(commission_points);
CREATE INDEX idx_partners_created_at ON Partners(created_at);

-- Composite index for common queries
CREATE INDEX idx_partners_type_status ON Partners(type, status);

-- Table comment
ALTER TABLE Partners COMMENT = 'Referral partners who bring patients to WeCare (guides, drivers, accommodation providers)';

-- Column comments
ALTER TABLE Partners 
    MODIFY COLUMN type ENUM('guide', 'driver', 'hotel', 'villa', 'guest_house', 'other') 
        COMMENT 'Type of partner service: guide=tour guide, driver=transportation, hotel/villa/guest_house=accommodation, other=miscellaneous',
    MODIFY COLUMN status ENUM('pending', 'active', 'inactive') 
        COMMENT 'Partner status: pending=awaiting approval, active=can refer patients, inactive=suspended/disabled',
    MODIFY COLUMN commission_points DECIMAL(10,2) 
        COMMENT 'Running total of commission points earned from successful referrals';