-- Migration: Create accounts_payable table
-- Tracks bills and expenses that WeCare owes to external entities
-- Links to external_entities for vendor management
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS accounts_payable (
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
        FOREIGN KEY (entity_id) REFERENCES external_entities(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_accounts_payable_entity_id ON accounts_payable(entity_id);
CREATE INDEX idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX idx_accounts_payable_due_date ON accounts_payable(due_date);
CREATE INDEX idx_accounts_payable_paid_date ON accounts_payable(paid_date);
CREATE INDEX idx_accounts_payable_reference_code ON accounts_payable(reference_code);
CREATE INDEX idx_accounts_payable_created_at ON accounts_payable(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_accounts_payable_entity_status ON accounts_payable(entity_id, status);
CREATE INDEX idx_accounts_payable_status_due_date ON accounts_payable(status, due_date);

-- Table comment
ALTER TABLE accounts_payable COMMENT = 'Bills and expenses owed by WeCare to external entities';

-- Column comments
ALTER TABLE accounts_payable 
    MODIFY COLUMN reference_code VARCHAR(100) 
        COMMENT 'External vendor invoice number or billing reference for reconciliation',
    MODIFY COLUMN status ENUM('due', 'paid', 'overdue') 
        COMMENT 'Payment status: due=payment pending within due date, paid=payment completed, overdue=past due date',
    MODIFY COLUMN total_amount DECIMAL(10,2) 
        COMMENT 'Total amount owed to external entity',
    MODIFY COLUMN payment_method VARCHAR(100) 
        COMMENT 'Payment method used: check, wire transfer, credit card, etc.';