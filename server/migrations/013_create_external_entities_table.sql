-- Migration: Create External_Entities table
-- Directory of external organizations that WeCare works with
-- Used for accounts payable and vendor management
-- Created: Phase 1

CREATE TABLE External_Entities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Organization name',
    type ENUM('hospital', 'lab', 'supplier', 'insurance_company', 'other') NOT NULL,
    contact_info JSON COMMENT 'Contact details: phone, email, address, contact person',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_external_entities_name ON External_Entities(name);
CREATE INDEX idx_external_entities_type ON External_Entities(type);
CREATE INDEX idx_external_entities_created_at ON External_Entities(created_at);

-- Table comment
ALTER TABLE External_Entities COMMENT = 'Directory of external organizations for vendor and partner management';

-- Column comments
ALTER TABLE External_Entities 
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