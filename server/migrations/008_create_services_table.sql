-- Migration: Create services table
-- Catalog of WeCare services with pricing and categorization
-- Used for invoice line items and service billing
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Service name (e.g., "Consultation - General Practitioner")',
    description TEXT COMMENT 'Detailed description of the service',
    price DECIMAL(10,2) NOT NULL COMMENT 'Standard price for the service',
    service_category ENUM('consultation', 'procedure', 'lab_test', 'room_charge', 'service_charge', 'other') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether the service is currently available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_service_category ON services(service_category);
CREATE INDEX idx_services_price ON services(price);
CREATE INDEX idx_services_name ON services(name);
CREATE INDEX idx_services_created_at ON services(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_services_category_active ON services(service_category, is_active);
CREATE INDEX idx_services_active_price ON services(is_active, price);

-- Table comment
ALTER TABLE services COMMENT = 'Catalog of WeCare services with pricing for billing and invoice generation';

-- Column comments
ALTER TABLE services 
    MODIFY COLUMN service_category ENUM('consultation', 'procedure', 'lab_test', 'room_charge', 'service_charge', 'other') 
        COMMENT 'Service category: consultation=doctor visits, procedure=medical procedures, lab_test=laboratory tests, room_charge=accommodation fees, service_charge=administrative fees, other=miscellaneous services',
    MODIFY COLUMN price DECIMAL(10,2) 
        COMMENT 'Standard service price - can be overridden in invoice items for special cases',
    MODIFY COLUMN is_active BOOLEAN 
        COMMENT 'Service availability flag - inactive services not shown to patients but kept for historical invoices';