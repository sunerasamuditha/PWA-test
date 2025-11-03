-- Migration: Create Audit_Logs table
-- Security and compliance tracking for all system changes
-- Records user actions for audit trails and compliance
-- Created: Phase 1

CREATE TABLE Audit_Logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'User who performed the action (NULL for system actions)',
    action ENUM('create', 'update', 'delete', 'login', 'logout', 'access') NOT NULL,
    target_entity VARCHAR(100) NOT NULL COMMENT 'Table/entity name that was affected',
    target_id INT NOT NULL COMMENT 'Primary key of the affected record',
    details_before JSON COMMENT 'Record state before the change (for update/delete)',
    details_after JSON COMMENT 'Record state after the change (for create/update)',
    ip_address VARCHAR(45) COMMENT 'Client IP address (supports IPv4 and IPv6)',
    user_agent VARCHAR(500) COMMENT 'Client user agent string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_audit_logs_user_id 
        FOREIGN KEY (user_id) REFERENCES Users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Indexes for performance and compliance queries
CREATE INDEX idx_audit_logs_user_id ON Audit_Logs(user_id);
CREATE INDEX idx_audit_logs_action ON Audit_Logs(action);
CREATE INDEX idx_audit_logs_target_entity ON Audit_Logs(target_entity);
CREATE INDEX idx_audit_logs_target_id ON Audit_Logs(target_id);
CREATE INDEX idx_audit_logs_created_at ON Audit_Logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON Audit_Logs(ip_address);

-- Composite indexes for common audit queries
CREATE INDEX idx_audit_logs_user_action ON Audit_Logs(user_id, action);
CREATE INDEX idx_audit_logs_entity_target ON Audit_Logs(target_entity, target_id);
CREATE INDEX idx_audit_logs_user_created_at ON Audit_Logs(user_id, created_at);
CREATE INDEX idx_audit_logs_action_created_at ON Audit_Logs(action, created_at);

-- Table comment
ALTER TABLE Audit_Logs COMMENT = 'Comprehensive audit trail for security, compliance, and change tracking';

-- Column comments
ALTER TABLE Audit_Logs 
    MODIFY COLUMN action ENUM('create', 'update', 'delete', 'login', 'logout', 'access') 
        COMMENT 'Action type: create=new record, update=modify record, delete=remove record, login=user login, logout=user logout, access=data access',
    MODIFY COLUMN target_entity VARCHAR(100) 
        COMMENT 'Name of database table or system entity that was affected',
    MODIFY COLUMN target_id INT 
        COMMENT 'Primary key ID of the specific record that was affected',
    MODIFY COLUMN details_before JSON 
        COMMENT 'Complete record state before modification (for update/delete operations)',
    MODIFY COLUMN details_after JSON 
        COMMENT 'Complete record state after modification (for create/update operations)',
    MODIFY COLUMN ip_address VARCHAR(45) 
        COMMENT 'Client IP address for security tracking and forensics',
    MODIFY COLUMN user_agent VARCHAR(500) 
        COMMENT 'Browser/client user agent string for device identification';