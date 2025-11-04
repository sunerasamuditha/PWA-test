-- Migration: Create external_entities table
-- Directory of external organizations that WeCare works with
-- Used for accounts payable and vendor management
-- Created: Phase 1

CREATE TABLE IF NOT EXISTS external_entities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Organization name',
    type ENUM('hospital', 'lab', 'supplier', 'insurance_company', 'other') NOT NULL,
    contact_info JSON COMMENT 'Contact details: phone, email, address, contact person',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_external_entities_name ON external_entities(name);
CREATE INDEX idx_external_entities_type ON external_entities(type);
CREATE INDEX idx_external_entities_created_at ON external_entities(created_at);

-- Table comment
ALTER TABLE external_entities COMMENT = 'Directory of external organizations for vendor and partner management';

-- Column comments
ALTER TABLE external_entities 
    MODIFY COLUMN type ENUM('hospital', 'lab', 'supplier', 'insurance_company', 'other') 
        COMMENT 'Entity type: hospital=medical facilities, lab=laboratory services, supplier=equipment/medicine suppliers, insurance_company=insurance providers, other=miscellaneous',
    MODIFY COLUMN contact_info JSON 
        COMMENT 'Contact information including phone, email, address, primary contact person';

-- Sample contact_info JSON structure:
-- {
--   "phone": "+1-555-123-4567",
--   "email": "contact@organization.com",
--   "address": {
--     "street": "123 Main St",
--     "city": "City Name",
--     "state": "State",
--     "country": "Country",
--     "postal_code": "12345"
--   },
--   "contact_person": {
--     "name": "John Doe",
--     "title": "Account Manager",
--     "direct_phone": "+1-555-123-4568",
--     "email": "john.doe@organization.com"
--   },
--   "billing_contact": {
--     "name": "Jane Smith", 
--     "email": "billing@organization.com",
--     "phone": "+1-555-123-4569"
--   }
-- }