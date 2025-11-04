-- Migration: Create staff_members table
-- Stores staff-specific information and permissions
-- Links to Users table with 1:1 relationship
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS staff_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    staff_role ENUM('front_desk', 'back_office', 'admin') NOT NULL,
    permissions JSON COMMENT 'Additional permissions array: ["manage_appointments", "process_payments", "view_reports"]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_staff_members_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_staff_members_user_id ON staff_members(user_id);
CREATE INDEX idx_staff_members_staff_role ON staff_members(staff_role);
CREATE INDEX idx_staff_members_created_at ON staff_members(created_at);

-- Table comment
ALTER TABLE staff_members COMMENT = 'WeCare staff members with specific roles and permissions';

-- Column comments
ALTER TABLE staff_members 
    MODIFY COLUMN staff_role ENUM('front_desk', 'back_office', 'admin') 
        COMMENT 'Staff role: front_desk=patient interaction, back_office=data management, admin=administrative functions',
    MODIFY COLUMN permissions JSON 
        COMMENT 'Additional granular permissions array for specific system functions';

-- Sample permissions JSON structure:
-- {
--   "permissions": [
--     "manage_appointments",
--     "process_payments", 
--     "view_reports",
--     "manage_documents",
--     "manage_users",
--     "system_settings"
--   ]
-- }