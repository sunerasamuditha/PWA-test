-- Migration: Create Staff_Shifts table
-- Tracks staff work hours and shift patterns for payroll and scheduling
-- Links to Users table for staff members
-- Created: Phase 1

CREATE TABLE Staff_Shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_user_id INT NOT NULL COMMENT 'Staff member working the shift',
    shift_type ENUM('full_night', 'day', 'intermediate') NOT NULL COMMENT 'full_night: 8pm-1pm, day: 1pm-9pm, intermediate: 11am-8pm',
    login_at TIMESTAMP NOT NULL COMMENT 'Actual shift start time',
    logout_at TIMESTAMP NULL COMMENT 'Actual shift end time (NULL if still logged in)',
    total_hours DECIMAL(5,2) COMMENT 'Calculated total hours worked (set on logout)',
    notes TEXT COMMENT 'Shift notes or incidents',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_staff_shifts_staff_user_id 
        FOREIGN KEY (staff_user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_staff_shifts_staff_user_id ON Staff_Shifts(staff_user_id);
CREATE INDEX idx_staff_shifts_shift_type ON Staff_Shifts(shift_type);
CREATE INDEX idx_staff_shifts_login_at ON Staff_Shifts(login_at);
CREATE INDEX idx_staff_shifts_logout_at ON Staff_Shifts(logout_at);
CREATE INDEX idx_staff_shifts_created_at ON Staff_Shifts(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_staff_shifts_user_login ON Staff_Shifts(staff_user_id, login_at);
CREATE INDEX idx_staff_shifts_user_type ON Staff_Shifts(staff_user_id, shift_type);

-- Table comment
ALTER TABLE Staff_Shifts COMMENT = 'Staff work shift tracking for payroll calculation and attendance monitoring';

-- Column comments
ALTER TABLE Staff_Shifts 
    MODIFY COLUMN shift_type ENUM('full_night', 'day', 'intermediate') 
        COMMENT 'Shift type with standard hours: full_night (8pm-1pm next day), day (1pm-9pm), intermediate (11am-8pm)',
    MODIFY COLUMN login_at TIMESTAMP 
        COMMENT 'Actual shift start time when staff member clocks in',
    MODIFY COLUMN logout_at TIMESTAMP 
        COMMENT 'Actual shift end time when staff member clocks out - NULL indicates still on shift',
    MODIFY COLUMN total_hours DECIMAL(5,2) 
        COMMENT 'Total hours worked - calculated as (logout_at - login_at) converted to decimal hours';