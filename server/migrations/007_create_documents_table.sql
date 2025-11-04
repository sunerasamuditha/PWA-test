-- Migration: Create documents table
-- Stores patient document metadata and file information
-- Actual files are stored on filesystem, this tracks metadata
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_user_id INT NOT NULL COMMENT 'Patient who owns the document',
    type ENUM('passport', 'insurance_card', 'test_result', 'diagnosis_card', 'lab_report', 'invoice', 'instruction_card', 'insurance_agreement', 'other') NOT NULL,
    file_path VARCHAR(500) NOT NULL COMMENT 'Secure file system path to the stored document',
    original_filename VARCHAR(255) NOT NULL COMMENT 'Original filename as uploaded by user',
    file_size INT COMMENT 'File size in bytes',
    mime_type VARCHAR(100) COMMENT 'MIME type of the file (e.g., application/pdf, image/jpeg)',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by_staff_id INT NULL COMMENT 'Staff member who uploaded the document (NULL for patient uploads)',
    
    -- Foreign key constraints
    CONSTRAINT fk_documents_patient_user_id 
        FOREIGN KEY (patient_user_id) REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_documents_uploaded_by_staff_id 
        FOREIGN KEY (uploaded_by_staff_id) REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_documents_patient_user_id ON documents(patient_user_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX idx_documents_uploaded_by_staff_id ON documents(uploaded_by_staff_id);
CREATE INDEX idx_documents_mime_type ON documents(mime_type);

-- Composite indexes for common queries
CREATE INDEX idx_documents_patient_type ON documents(patient_user_id, type);
CREATE INDEX idx_documents_patient_uploaded_at ON documents(patient_user_id, uploaded_at);

-- Table comment
ALTER TABLE documents COMMENT = 'Patient document metadata and file storage tracking for secure document management';

-- Column comments
ALTER TABLE documents 
    MODIFY COLUMN type ENUM('passport', 'insurance_card', 'test_result', 'diagnosis_card', 'lab_report', 'invoice', 'instruction_card', 'insurance_agreement', 'other') 
        COMMENT 'Document type: passport=travel document, insurance_card=insurance info, test_result=medical test, diagnosis_card=diagnosis info, lab_report=laboratory results, invoice=billing document, instruction_card=medical instructions, insurance_agreement=insurance contract, other=miscellaneous',
    MODIFY COLUMN file_path VARCHAR(500) 
        COMMENT 'Secure file system path - should be outside web root for security',
    MODIFY COLUMN file_size INT 
        COMMENT 'File size in bytes for storage management and limits',
    MODIFY COLUMN mime_type VARCHAR(100) 
        COMMENT 'MIME type for proper file handling and security validation';