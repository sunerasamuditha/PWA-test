-- Migration: Create invoice_items table
-- Line items for invoices - individual services and charges
-- Links invoices to services with quantity and pricing details
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL COMMENT 'Invoice this item belongs to',
    service_id INT NULL COMMENT 'Reference to services table (NULL for custom items)',
    item_description VARCHAR(500) NOT NULL COMMENT 'Description of the service/item (copied from services or custom)',
    quantity INT DEFAULT 1 COMMENT 'Number of units/instances of this service',
    unit_price DECIMAL(10,2) NOT NULL COMMENT 'Price per unit at time of billing (may differ from current service price)',
    total_price DECIMAL(10,2) NOT NULL COMMENT 'Total price for this line item (quantity * unit_price)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_invoice_items_invoice_id 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_invoice_items_service_id 
        FOREIGN KEY (service_id) REFERENCES services(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    -- Ensure total_price = quantity * unit_price (enforced at application level)
    CONSTRAINT chk_invoice_items_total_price 
        CHECK (total_price = quantity * unit_price)
);

-- Indexes for performance
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_service_id ON invoice_items(service_id);
CREATE INDEX idx_invoice_items_created_at ON invoice_items(created_at);

-- Table comment
ALTER TABLE invoice_items COMMENT = 'Individual line items on invoices with service details and pricing';

-- Column comments
ALTER TABLE invoice_items 
    MODIFY COLUMN item_description VARCHAR(500) 
        COMMENT 'Service description - copied from services table or custom description for non-catalog items',
    MODIFY COLUMN quantity INT 
        COMMENT 'Number of units of this service (e.g., 3 lab tests, 2 nights room charge)',
    MODIFY COLUMN unit_price DECIMAL(10,2) 
        COMMENT 'Price per unit at time of billing - historical pricing for accurate records',
    MODIFY COLUMN total_price DECIMAL(10,2) 
        COMMENT 'Total line item cost - must equal quantity × unit_price';