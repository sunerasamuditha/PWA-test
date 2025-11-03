-- Migration: Create Staff_Members table
-- Stores staff-specific information and permissions
-- Links to Users table with 1:1 relationship
-- Created: Phase 1

CREATE TABLE Staff_Members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    staff_role ENUM('front_desk', 'back_office', 'admin') NOT NULL,
    permissions JSON COMMENT 'Additional permissions array: ["manage_appointments", "process_payments", "view_reports"]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_staff_members_user_id 
        FOREIGN KEY (user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_staff_members_user_id ON Staff_Members(user_id);
CREATE INDEX idx_staff_members_staff_role ON Staff_Members(staff_role);
CREATE INDEX idx_staff_members_created_at ON Staff_Members(created_at);

-- Table comment
ALTER TABLE Staff_Members COMMENT = 'WeCare staff members with specific roles and permissions';

-- Column comments
ALTER TABLE Staff_Members 
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