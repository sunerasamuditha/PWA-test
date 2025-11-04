-- Migration: Create payments table
-- Records actual payments made against invoices
-- Supports partial payments and multiple payment methods
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL COMMENT 'Invoice this payment is for',
    amount DECIMAL(10,2) NOT NULL COMMENT 'Payment amount (may be partial)',
    payment_method ENUM('cash', 'card', 'bank_transfer', 'insurance') NOT NULL,
    transaction_id VARCHAR(255) COMMENT 'External payment system transaction ID',
    payment_status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
    notes TEXT COMMENT 'Additional payment notes or reference information',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_by_staff_id INT NULL COMMENT 'Staff member who recorded the payment',
    
    -- Foreign key constraints
    CONSTRAINT fk_payments_invoice_id 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_payments_recorded_by_staff_id 
        FOREIGN KEY (recorded_by_staff_id) REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_payment_status ON payments(payment_status);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_payments_recorded_by_staff_id ON payments(recorded_by_staff_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);

-- Composite indexes for common queries
CREATE INDEX idx_payments_invoice_status ON payments(invoice_id, payment_status);
CREATE INDEX idx_payments_method_date ON payments(payment_method, paid_at);

-- Table comment
ALTER TABLE payments COMMENT = 'Payment records for invoices supporting multiple payments per invoice';

-- Column comments
ALTER TABLE payments 
    MODIFY COLUMN payment_method ENUM('cash', 'card', 'bank_transfer', 'insurance') 
        COMMENT 'Payment method: cash=cash payment, card=credit/debit card, bank_transfer=wire/ACH transfer, insurance=insurance payment',
    MODIFY COLUMN payment_status ENUM('completed', 'pending', 'failed') 
        COMMENT 'Payment status: completed=payment processed successfully, pending=payment processing, failed=payment failed or rejected',
    MODIFY COLUMN transaction_id VARCHAR(255) 
        COMMENT 'External transaction reference from payment processor or bank',
    MODIFY COLUMN amount DECIMAL(10,2) 
        COMMENT 'Payment amount - can be partial payment toward invoice total';