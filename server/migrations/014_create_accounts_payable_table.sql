-- Migration: Create Accounts_Payable table
-- Tracks bills and expenses that WeCare owes to external entities
-- Links to External_Entities for vendor management
-- Created: Phase 1

CREATE TABLE Accounts_Payable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_id INT NOT NULL COMMENT 'External entity we owe money to',
    reference_code VARCHAR(100) COMMENT 'External invoice/bill number or reference',
    description TEXT COMMENT 'Description of what the bill is for',
    total_amount DECIMAL(10,2) NOT NULL COMMENT 'Total amount owed',
    due_date DATE NOT NULL COMMENT 'Payment due date',
    paid_date DATE NULL COMMENT 'Date payment was made (NULL if unpaid)',
    status ENUM('due', 'paid', 'overdue') DEFAULT 'due',
    payment_method VARCHAR(100) COMMENT 'Method used for payment (check, transfer, etc.)',
    notes TEXT COMMENT 'Additional notes about the bill or payment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_accounts_payable_entity_id 
        FOREIGN KEY (entity_id) REFERENCES External_Entities(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_accounts_payable_entity_id ON Accounts_Payable(entity_id);
CREATE INDEX idx_accounts_payable_status ON Accounts_Payable(status);
CREATE INDEX idx_accounts_payable_due_date ON Accounts_Payable(due_date);
CREATE INDEX idx_accounts_payable_paid_date ON Accounts_Payable(paid_date);
CREATE INDEX idx_accounts_payable_reference_code ON Accounts_Payable(reference_code);
CREATE INDEX idx_accounts_payable_created_at ON Accounts_Payable(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_accounts_payable_entity_status ON Accounts_Payable(entity_id, status);
CREATE INDEX idx_accounts_payable_status_due_date ON Accounts_Payable(status, due_date);

-- Table comment
ALTER TABLE Accounts_Payable COMMENT = 'Bills and expenses owed by WeCare to external entities';

-- Column comments
ALTER TABLE Accounts_Payable 
    MODIFY COLUMN reference_code VARCHAR(100) 
        COMMENT 'External vendor invoice number or billing reference for reconciliation',
    MODIFY COLUMN status ENUM('due', 'paid', 'overdue') 
        COMMENT 'Payment status: due=payment pending within due date, paid=payment completed, overdue=past due date',
    MODIFY COLUMN total_amount DECIMAL(10,2) 
        COMMENT 'Total amount owed to external entity',
    MODIFY COLUMN payment_method VARCHAR(100) 
        COMMENT 'Payment method used: check, wire transfer, credit card, etc.';