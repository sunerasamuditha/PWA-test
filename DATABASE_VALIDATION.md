# Database Schema Validation - PWA-POS Compatibility

## Overview

This document addresses the critical requirement for database schema consistency between the WeCare PWA and the future POS (Point of Service) system. Both systems will share the same MySQL database (`wecare_db`) to ensure data consistency and real-time synchronization.

## Shared Database Architecture

### Database Configuration
- **Database Name**: `wecare_db` (production) / `wecare_test_db` (testing)
- **MySQL Version**: 8.0+
- **Character Set**: utf8mb4
- **Collation**: utf8mb4_unicode_ci
- **Engine**: InnoDB (for ACID compliance and foreign key support)

### Connection Pool Strategy
- **PWA System**: Dedicated connection pool (max 20 connections)
- **POS System**: Separate connection pool (max 20 connections)
- **Total Capacity**: 40 concurrent database connections
- **Isolation Level**: READ COMMITTED (prevents dirty reads)

## Table Ownership Matrix

### Tables Used by Both PWA and POS

| Table | Primary Owner | POS Access | PWA Access | Notes |
|-------|---------------|------------|------------|-------|
| `Users` | PWA | READ, UPDATE | FULL | Authentication for both systems |
| `Patients` | PWA | READ, CREATE, UPDATE | FULL | Patient registration from both systems |
| `Staff_Members` | PWA | READ | FULL | Staff work in both systems |
| `Appointments` | Both | FULL | FULL | Core shared entity |
| `Documents` | PWA | CREATE | FULL | POS uploads treatment records |
| `Services` | PWA | READ | FULL | Service catalog for billing |
| `Invoices` | Both | FULL | FULL | Billing from both systems |
| `Invoice_Items` | Both | FULL | FULL | Line items for invoices |
| `Invoice_Sequences` | Both | FULL | FULL | Sequential invoice numbering |
| `Payments` | Both | FULL | FULL | Payment recording |
| `Staff_Shifts` | PWA | READ | FULL | Shift tracking spans both systems |
| `External_Entities` | PWA | READ | FULL | Coop hospital reference |
| `Accounts_Payable` | PWA | READ, CREATE | FULL | Monthly bills to Coop |
| `Audit_Logs` | Both | CREATE | CREATE | Both systems log operations |

### Tables Used Only by PWA

| Table | Purpose | POS Access |
|-------|---------|------------|
| `Partners` | Partner/referral management | NONE |
| `Referrals` | QR referral tracking | NONE |
| `Push_Subscriptions` | PWA notifications | NONE |

## Potential Conflicts & Mitigation

### 1. Concurrent Updates to Same Record

**Risk**: PWA and POS updating same patient/invoice simultaneously

**Mitigation**:
- Use optimistic locking with `version` column (future enhancement)
- Transaction isolation level prevents dirty reads
- Last-write-wins strategy (timestamp-based)
- Audit logs track all changes for conflict resolution

### 2. Transaction Isolation

**Risk**: Phantom reads, non-repeatable reads

**Mitigation**:
- `READ COMMITTED` isolation level (default)
- Short transaction duration (<1 second)
- Explicit locking for critical operations (SELECT FOR UPDATE)
- Retry logic for deadlock errors

### 3. Connection Pool Exhaustion

**Risk**: All connections consumed, requests timeout

**Mitigation**:
- Separate connection pools (20 per system)
- Connection timeout: 10 seconds
- Connection lifetime: 30 minutes
- Monitor connection usage via metrics

### 4. Audit Log Volume

**Risk**: Audit table grows rapidly with two systems

**Mitigation**:
- Automatic cleanup of logs older than 90 days
- Partition Audit_Logs table by month (future enhancement)
- Archive old logs to separate storage
- Index on `timestamp` for efficient queries

## Database Validation Queries

### 1. Foreign Key Integrity

```sql
-- Check for orphaned patients (user doesn't exist)
SELECT p.id, p.user_id 
FROM Patients p 
LEFT JOIN Users u ON p.user_id = u.id 
WHERE u.id IS NULL;
-- Expected: 0 rows

-- Check for orphaned appointments (patient doesn't exist)
SELECT a.id, a.patient_user_id 
FROM Appointments a 
LEFT JOIN Users u ON a.patient_user_id = u.id 
WHERE u.id IS NULL;
-- Expected: 0 rows

-- Check for orphaned invoices (patient doesn't exist)
SELECT i.id, i.patient_user_id 
FROM Invoices i 
LEFT JOIN Users u ON i.patient_user_id = u.id 
WHERE u.id IS NULL;
-- Expected: 0 rows

-- Check for orphaned invoice items (invoice doesn't exist)
SELECT ii.id, ii.invoice_id 
FROM Invoice_Items ii 
LEFT JOIN Invoices i ON ii.invoice_id = i.id 
WHERE i.id IS NULL;
-- Expected: 0 rows

-- Check for orphaned payments (invoice doesn't exist)
SELECT p.id, p.invoice_id 
FROM Payments p 
LEFT JOIN Invoices i ON p.invoice_id = i.id 
WHERE i.id IS NULL;
-- Expected: 0 rows
```

### 2. Data Consistency

```sql
-- Verify invoice totals match line items
SELECT 
    i.id, 
    i.total_amount, 
    SUM(ii.total_price) as calculated_total
FROM Invoices i
LEFT JOIN Invoice_Items ii ON i.id = ii.invoice_id
GROUP BY i.id, i.total_amount
HAVING i.total_amount != COALESCE(SUM(ii.total_price), 0);
-- Expected: 0 rows

-- Verify payments don't exceed invoice amounts
SELECT 
    i.id,
    i.total_amount,
    SUM(p.amount) as total_paid
FROM Invoices i
LEFT JOIN Payments p ON i.id = p.invoice_id
GROUP BY i.id, i.total_amount
HAVING SUM(p.amount) > i.total_amount;
-- Expected: 0 rows

-- Verify commission points match referral counts
SELECT 
    p.user_id,
    p.commission_points,
    COUNT(r.id) * 10.00 as expected_points
FROM Partners p
LEFT JOIN Referrals r ON p.user_id = r.partner_user_id
GROUP BY p.user_id, p.commission_points
HAVING p.commission_points != COALESCE(COUNT(r.id) * 10.00, 0);
-- Expected: 0 rows

-- Verify shift hours are calculated correctly
SELECT 
    id,
    total_hours,
    TIMESTAMPDIFF(MINUTE, login_at, logout_at) / 60.0 as calculated_hours
FROM Staff_Shifts
WHERE logout_at IS NOT NULL
AND ABS(total_hours - (TIMESTAMPDIFF(MINUTE, login_at, logout_at) / 60.0)) > 0.01;
-- Expected: 0 rows
```

### 3. JSON Field Validation

```sql
-- Verify passport_info is valid JSON
SELECT id, user_id 
FROM Patients 
WHERE passport_info IS NOT NULL 
AND NOT JSON_VALID(passport_info);
-- Expected: 0 rows

-- Verify insurance_info is valid JSON
SELECT id, user_id 
FROM Patients 
WHERE insurance_info IS NOT NULL 
AND NOT JSON_VALID(insurance_info);
-- Expected: 0 rows

-- Verify contact_info is valid JSON
SELECT id 
FROM External_Entities 
WHERE contact_info IS NOT NULL 
AND NOT JSON_VALID(contact_info);
-- Expected: 0 rows

-- Verify permissions is valid JSON array
SELECT id, user_id 
FROM Staff_Members 
WHERE permissions IS NOT NULL 
AND NOT JSON_VALID(permissions);
-- Expected: 0 rows
```

### 4. Enum Value Validation

```sql
-- Verify user roles are valid
SELECT role, COUNT(*) 
FROM Users 
WHERE role NOT IN ('patient', 'partner', 'staff', 'admin', 'super_admin')
GROUP BY role;
-- Expected: 0 rows

-- Verify appointment statuses are valid
SELECT status, COUNT(*) 
FROM Appointments 
WHERE status NOT IN ('scheduled', 'checked_in', 'completed', 'cancelled')
GROUP BY status;
-- Expected: 0 rows

-- Verify invoice statuses are valid
SELECT status, COUNT(*) 
FROM Invoices 
WHERE status NOT IN ('pending', 'paid', 'partially_paid', 'overdue', 'cancelled')
GROUP BY status;
-- Expected: 0 rows

-- Verify payment methods are valid
SELECT payment_method, COUNT(*) 
FROM Invoices 
WHERE payment_method NOT IN ('cash', 'card', 'insurance_credit', 'bank_transfer')
GROUP BY payment_method;
-- Expected: 0 rows
```

### 5. Date Constraint Validation

```sql
-- Verify future appointments have valid dates
SELECT id, appointment_datetime 
FROM Appointments 
WHERE status = 'scheduled' 
AND appointment_datetime < NOW();
-- Expected: 0 rows (scheduled appointments shouldn't be in past)

-- Verify insurance credit invoices have due dates
SELECT id 
FROM Invoices 
WHERE payment_method = 'insurance_credit' 
AND status != 'paid'
AND due_date IS NULL;
-- Expected: 0 rows

-- Verify passport expiry dates are in future for active patients
SELECT p.id, JSON_EXTRACT(p.passport_info, '$.expiryDate') as expiry 
FROM Patients p 
WHERE p.passport_info IS NOT NULL 
AND JSON_VALID(p.passport_info)
AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p.passport_info, '$.expiryDate')), '%Y-%m-%d') < CURDATE();
-- Expected: Alerts for expired passports (not an error, but needs attention)
```

### 6. Index Usage Analysis

```sql
-- Analyze appointment query performance
EXPLAIN SELECT * FROM Appointments 
WHERE patient_user_id = 1 
AND status = 'scheduled' 
ORDER BY appointment_datetime;
-- Expected: Uses idx_appointments_patient index

-- Analyze invoice query performance
EXPLAIN SELECT * FROM Invoices 
WHERE patient_user_id = 1 
AND status = 'pending';
-- Expected: Uses idx_invoices_patient index

-- Analyze audit log query performance
EXPLAIN SELECT * FROM Audit_Logs 
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
ORDER BY timestamp DESC;
-- Expected: Uses idx_audit_logs_timestamp index
```

### 7. Cascade Behavior Tests

```sql
-- Test cascade delete (DO NOT RUN IN PRODUCTION)
-- Create test user
INSERT INTO Users (email, password_hash, full_name, role) 
VALUES ('test@delete.com', 'hash', 'Test Delete', 'patient');
SET @test_user_id = LAST_INSERT_ID();

-- Create dependent records
INSERT INTO Patients (user_id) VALUES (@test_user_id);
INSERT INTO Appointments (patient_user_id, appointment_datetime, type, status) 
VALUES (@test_user_id, NOW() + INTERVAL 1 DAY, 'opd', 'scheduled');

-- Delete user and verify cascades
DELETE FROM Users WHERE id = @test_user_id;

-- Verify cascade
SELECT COUNT(*) FROM Patients WHERE user_id = @test_user_id;
-- Expected: 0

SELECT COUNT(*) FROM Appointments WHERE patient_user_id = @test_user_id;
-- Expected: 0
```

### 8. Duplicate Detection

```sql
-- Check for duplicate referrals (violates unique constraint)
SELECT partner_user_id, patient_user_id, COUNT(*) 
FROM Referrals 
GROUP BY partner_user_id, patient_user_id 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check for duplicate invoice numbers
SELECT invoice_number, COUNT(*) 
FROM Invoices 
GROUP BY invoice_number 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check for duplicate email addresses
SELECT email, COUNT(*) 
FROM Users 
WHERE deleted_at IS NULL
GROUP BY email 
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### 9. Performance Checks

```sql
-- Identify slow queries (>1 second)
SELECT * FROM information_schema.PROCESSLIST 
WHERE Time > 1 
AND Command != 'Sleep';

-- Identify missing indexes (table scans)
-- Review EXPLAIN plans for common queries

-- Identify large tables needing partitioning
SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
    table_rows
FROM information_schema.TABLES
WHERE table_schema = 'wecare_db'
ORDER BY (data_length + index_length) DESC;
```

### 10. PWA-POS Compatibility Checks

```sql
-- Verify all shared tables exist
SELECT table_name 
FROM information_schema.TABLES 
WHERE table_schema = 'wecare_db' 
AND table_name IN (
    'Users', 'Patients', 'Staff_Members', 'Appointments', 
    'Documents', 'Services', 'Invoices', 'Invoice_Items', 
    'Payments', 'Staff_Shifts', 'External_Entities', 
    'Accounts_Payable', 'Audit_Logs'
);
-- Expected: 13 rows

-- Verify no PWA-specific constraints blocking POS
-- (Manual review of table definitions)
SHOW CREATE TABLE Appointments;
SHOW CREATE TABLE Invoices;
SHOW CREATE TABLE Payments;
```

## POS System Requirements

### Database Access

**Required Permissions**:
```sql
-- POS system user should have:
GRANT SELECT, INSERT, UPDATE ON wecare_db.Users TO 'pos_user'@'%';
GRANT SELECT, INSERT, UPDATE ON wecare_db.Patients TO 'pos_user'@'%';
GRANT SELECT ON wecare_db.Staff_Members TO 'pos_user'@'%';
GRANT SELECT, INSERT, UPDATE ON wecare_db.Appointments TO 'pos_user'@'%';
GRANT SELECT, INSERT ON wecare_db.Documents TO 'pos_user'@'%';
GRANT SELECT ON wecare_db.Services TO 'pos_user'@'%';
GRANT SELECT, INSERT, UPDATE ON wecare_db.Invoices TO 'pos_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON wecare_db.Invoice_Items TO 'pos_user'@'%';
GRANT SELECT, INSERT ON wecare_db.Payments TO 'pos_user'@'%';
GRANT SELECT, INSERT ON wecare_db.Audit_Logs TO 'pos_user'@'%';
```

### Authentication
- POS system must authenticate via `Users` table
- POS users should have `role='staff'`
- POS users should have `staff_role` in `Staff_Members` table (`front_desk` or `back_office`)
- JWT tokens use same secret key as PWA
- Session management follows same security policies

### Audit Logging
- POS must log all operations to `Audit_Logs` table
- Use same audit middleware pattern as PWA
- Include `user_id`, `action`, `target_entity`, `target_id`, `ip_address`, `user_agent`
- Record `details_before` and `details_after` for updates

### Business Rules
- **Invoice Numbers**: Follow format `WC-YYYY-NNNN` (sequential)
- **Payment Workflows**: Same status transitions (pending→partially_paid→paid)
- **Document Types**: Use same enum values
- **Appointment Types**: Use same enum values (opd, admission)

## Schema Compatibility Guarantees

### Migration Strategy
1. **Additive Only**: Never drop columns or tables
2. **Backward Compatible**: New columns have default values
3. **Enum Expansion**: Add new enum values at end (never remove)
4. **Foreign Keys**: Maintain all referential integrity constraints
5. **Indexes**: Add indexes without disrupting existing queries

### Version Control
- All migrations numbered sequentially (001, 002, 003...)
- Migration files version-controlled in Git
- Production migrations require approval from both PWA and POS teams
- Test migrations on `wecare_test_db` before production

### Communication Protocol
- Schema changes announced 1 week before deployment
- Breaking changes require coordination between teams
- Emergency hotfixes communicated immediately
- Monthly schema review meetings

## Recommendations for POS Development

### 1. Database Connection
```javascript
// Use same database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'wecare_db',
  port: process.env.DB_PORT || 3306,
  connectionLimit: 20, // Separate pool for POS
  waitForConnections: true,
  queueLimit: 0
};
```

### 2. Audit Logging Middleware
```javascript
// Implement same audit pattern
const auditLog = async (req, res, next) => {
  // Log after operation completes
  res.on('finish', async () => {
    await AuditLog.create({
      user_id: req.user.id,
      action: req.method === 'POST' ? 'create' : 'update',
      target_entity: determineEntity(req.path),
      target_id: res.locals.recordId,
      details_before: res.locals.detailsBefore,
      details_after: res.locals.detailsAfter,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
  });
  next();
};
```

### 3. Naming Conventions
- **Database**: `snake_case` (e.g., `patient_user_id`)
- **Code**: `camelCase` (e.g., `patientUserId`)
- **Endpoints**: kebab-case (e.g., `/api/appointments/:id/check-in`)

### 4. Validation Rules
- Reuse same validation utilities as PWA
- Enforce same constraints (email format, phone format, dates)
- Use same error message format for consistency

### 5. Schema Migration Coordination
- POS team monitors PWA migration repository
- Test POS system against new migrations before production
- Coordinate deployment windows to avoid downtime
- Maintain migration compatibility matrix

## Monitoring & Alerts

### Database Metrics to Monitor
- Connection pool usage (alert if >80% utilized)
- Query response times (alert if >1 second)
- Deadlock occurrences (alert on any deadlock)
- Foreign key violations (alert on constraint errors)
- Audit log growth rate (alert if >10K records/day)

### Health Checks
- Daily foreign key integrity validation
- Weekly data consistency checks
- Monthly index usage analysis
- Quarterly table size review

---

**Document Version**: 1.0  
**Last Updated**: November 3, 2025  
**Maintained By**: Database Team & QA Team
