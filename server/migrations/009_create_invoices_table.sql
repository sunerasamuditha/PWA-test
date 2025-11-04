-- Migration: Create invoices table
-- Patient billing and payment tracking
-- Links to patients and optionally to appointments
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Human-readable invoice identifier (e.g., WC-2024-001)',
    appointment_id INT NULL COMMENT 'Optional link to appointment (NULL for walk-in or running bills)',
    patient_user_id INT NOT NULL COMMENT 'Patient being billed',
    prepared_by_staff_id INT NULL COMMENT 'Staff member who prepared the invoice',
    total_amount DECIMAL(10,2) NOT NULL COMMENT 'Total invoice amount',
    payment_method ENUM('cash', 'card', 'insurance_credit') NOT NULL,
    status ENUM('pending', 'paid', 'overdue', 'partially_paid') DEFAULT 'pending',
    invoice_type ENUM('opd', 'admission', 'running_bill') NOT NULL,
    due_date DATE COMMENT 'Payment due date (NULL for immediate payment)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_invoices_appointment_id 
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_invoices_patient_user_id 
        FOREIGN KEY (patient_user_id) REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_invoices_prepared_by_staff_id 
        FOREIGN KEY (prepared_by_staff_id) REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_appointment_id ON invoices(appointment_id);
CREATE INDEX idx_invoices_patient_user_id ON invoices(patient_user_id);
CREATE INDEX idx_invoices_prepared_by_staff_id ON invoices(prepared_by_staff_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_invoices_patient_status ON invoices(patient_user_id, status);
CREATE INDEX idx_invoices_status_due_date ON invoices(status, due_date);
CREATE INDEX idx_invoices_patient_created_at ON invoices(patient_user_id, created_at);

-- Table comment
ALTER TABLE invoices COMMENT = 'Patient invoices and billing records with payment tracking';

-- Column comments
ALTER TABLE invoices 
    MODIFY COLUMN invoice_number VARCHAR(50) 
        COMMENT 'Human-readable invoice number following format: WC-YYYY-NNNN',
    MODIFY COLUMN payment_method ENUM('cash', 'card', 'insurance_credit') 
        COMMENT 'Expected payment method: cash=cash payment, card=credit/debit card, insurance_credit=insurance coverage',
    MODIFY COLUMN status ENUM('pending', 'paid', 'overdue', 'partially_paid') 
        COMMENT 'Payment status: pending=awaiting payment, paid=fully paid, overdue=past due date, partially_paid=partial payment received',
    MODIFY COLUMN invoice_type ENUM('opd', 'admission', 'running_bill') 
        COMMENT 'Invoice type: opd=outpatient services, admission=inpatient services, running_bill=ongoing treatment charges',
    MODIFY COLUMN total_amount DECIMAL(10,2) 
        COMMENT 'Total invoice amount - sum of all invoice items';