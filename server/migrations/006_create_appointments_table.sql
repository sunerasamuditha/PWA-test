-- Migration: Create Appointments table
-- Stores patient appointments with scheduling and status tracking
-- Links to Users table for patients and staff
-- Created: Phase 1

CREATE TABLE Appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_user_id INT NOT NULL COMMENT 'Patient who has the appointment',
    created_by_staff_id INT NULL COMMENT 'Staff member who created the appointment (NULL for patient self-booking)',
    appointment_datetime DATETIME NOT NULL,
    status ENUM('scheduled', 'checked_in', 'completed', 'cancelled') DEFAULT 'scheduled',
    appointment_type ENUM('opd', 'admission') NOT NULL,
    notes TEXT COMMENT 'Additional notes about the appointment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_appointments_patient_user_id 
        FOREIGN KEY (patient_user_id) REFERENCES Users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_appointments_created_by_staff_id 
        FOREIGN KEY (created_by_staff_id) REFERENCES Users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_appointments_patient_user_id ON Appointments(patient_user_id);
CREATE INDEX idx_appointments_created_by_staff_id ON Appointments(created_by_staff_id);
CREATE INDEX idx_appointments_appointment_datetime ON Appointments(appointment_datetime);
CREATE INDEX idx_appointments_status ON Appointments(status);
CREATE INDEX idx_appointments_appointment_type ON Appointments(appointment_type);
CREATE INDEX idx_appointments_created_at ON Appointments(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_appointments_patient_status ON Appointments(patient_user_id, status);
CREATE INDEX idx_appointments_patient_datetime ON Appointments(patient_user_id, appointment_datetime);
CREATE INDEX idx_appointments_datetime_status ON Appointments(appointment_datetime, status);

-- Table comment
ALTER TABLE Appointments COMMENT = 'Patient appointments with scheduling, status tracking, and staff assignment';

-- Column comments
ALTER TABLE Appointments 
    MODIFY COLUMN status ENUM('scheduled', 'checked_in', 'completed', 'cancelled') 
        COMMENT 'Appointment status: scheduled=confirmed appointment, checked_in=patient arrived, completed=appointment finished, cancelled=appointment cancelled',
    MODIFY COLUMN appointment_type ENUM('opd', 'admission') 
        COMMENT 'Type of appointment: opd=outpatient department (consultation), admission=inpatient admission';