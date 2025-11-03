-- =====================================================
-- WeCare Database Validation Script
-- Purpose: Verify database integrity and PWA-POS compatibility
-- Run this script regularly to ensure data consistency
-- =====================================================

-- Set output format for readability
SET @divider = REPEAT('=', 80);

-- =====================================================
-- SECTION 1: FOREIGN KEY INTEGRITY CHECKS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 1: FOREIGN KEY INTEGRITY CHECKS' as '';
SELECT @divider as '';

-- Check 1.1: Orphaned Patients (user doesn't exist)
SELECT 'Check 1.1: Orphaned Patients' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned patients found') 
    END as 'Result'
FROM Patients p 
LEFT JOIN Users u ON p.user_id = u.id 
WHERE u.id IS NULL;

SELECT p.id, p.user_id 
FROM Patients p 
LEFT JOIN Users u ON p.user_id = u.id 
WHERE u.id IS NULL
LIMIT 10;

-- Check 1.2: Orphaned Partners (user doesn't exist)
SELECT 'Check 1.2: Orphaned Partners' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned partners found') 
    END as 'Result'
FROM Partners p 
LEFT JOIN Users u ON p.user_id = u.id 
WHERE u.id IS NULL;

-- Check 1.3: Orphaned Staff (user doesn't exist)
SELECT 'Check 1.3: Orphaned Staff' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned staff found') 
    END as 'Result'
FROM Staff_Members s 
LEFT JOIN Users u ON s.user_id = u.id 
WHERE u.id IS NULL;

-- Check 1.4: Orphaned Referrals (partner or patient doesn't exist)
SELECT 'Check 1.4: Orphaned Referrals' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned referrals found') 
    END as 'Result'
FROM Referrals r 
WHERE r.partner_user_id NOT IN (SELECT user_id FROM Partners)
   OR r.patient_user_id NOT IN (SELECT id FROM Users WHERE role='patient');

-- Check 1.5: Orphaned Appointments (patient doesn't exist)
SELECT 'Check 1.5: Orphaned Appointments' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned appointments found') 
    END as 'Result'
FROM Appointments a 
LEFT JOIN Users u ON a.patient_user_id = u.id 
WHERE u.id IS NULL;

-- Check 1.6: Orphaned Documents (patient doesn't exist)
SELECT 'Check 1.6: Orphaned Documents' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned documents found') 
    END as 'Result'
FROM Documents d 
LEFT JOIN Users u ON d.patient_user_id = u.id 
WHERE u.id IS NULL;

-- Check 1.7: Orphaned Invoices (patient doesn't exist)
SELECT 'Check 1.7: Orphaned Invoices' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned invoices found') 
    END as 'Result'
FROM Invoices i 
LEFT JOIN Users u ON i.patient_user_id = u.id 
WHERE u.id IS NULL;

-- Check 1.8: Orphaned Invoice Items (invoice doesn't exist)
SELECT 'Check 1.8: Orphaned Invoice Items' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned invoice items found') 
    END as 'Result'
FROM Invoice_Items ii 
LEFT JOIN Invoices i ON ii.invoice_id = i.id 
WHERE i.id IS NULL;

-- Check 1.9: Orphaned Payments (invoice doesn't exist)
SELECT 'Check 1.9: Orphaned Payments' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned payments found') 
    END as 'Result'
FROM Payments p 
LEFT JOIN Invoices i ON p.invoice_id = i.id 
WHERE i.id IS NULL;

-- Check 1.10: Orphaned Staff Shifts (staff doesn't exist)
SELECT 'Check 1.10: Orphaned Staff Shifts' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned shifts found') 
    END as 'Result'
FROM Staff_Shifts ss 
LEFT JOIN Staff_Members s ON ss.staff_user_id = s.user_id 
WHERE s.user_id IS NULL;

-- Check 1.11: Orphaned Accounts Payable (entity doesn't exist)
SELECT 'Check 1.11: Orphaned Accounts Payable' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' orphaned payables found') 
    END as 'Result'
FROM Accounts_Payable ap 
LEFT JOIN External_Entities e ON ap.entity_id = e.id 
WHERE e.id IS NULL;

-- =====================================================
-- SECTION 2: DATA CONSISTENCY CHECKS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 2: DATA CONSISTENCY CHECKS' as '';
SELECT @divider as '';

-- Check 2.1: Invoice totals match line items
SELECT 'Check 2.1: Invoice Total Consistency' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' invoices with incorrect totals') 
    END as 'Result'
FROM (
    SELECT 
        i.id, 
        i.total_amount, 
        COALESCE(SUM(ii.total_price), 0) as calculated_total
    FROM Invoices i
    LEFT JOIN Invoice_Items ii ON i.id = ii.invoice_id
    GROUP BY i.id, i.total_amount
    HAVING ABS(i.total_amount - COALESCE(SUM(ii.total_price), 0)) > 0.01
) as inconsistent_invoices;

-- Show details of inconsistent invoices
SELECT i.id, i.invoice_number, i.total_amount, SUM(ii.total_price) as calculated_total
FROM Invoices i
LEFT JOIN Invoice_Items ii ON i.id = ii.invoice_id
GROUP BY i.id, i.invoice_number, i.total_amount
HAVING ABS(i.total_amount - COALESCE(SUM(ii.total_price), 0)) > 0.01
LIMIT 10;

-- Check 2.2: Payments don't exceed invoice amounts
SELECT 'Check 2.2: Payment Total Consistency' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' invoices with overpayment') 
    END as 'Result'
FROM (
    SELECT 
        i.id,
        i.total_amount,
        COALESCE(SUM(p.amount), 0) as total_paid
    FROM Invoices i
    LEFT JOIN Payments p ON i.id = p.invoice_id
    GROUP BY i.id, i.total_amount
    HAVING SUM(p.amount) > i.total_amount
) as overpaid_invoices;

-- Check 2.3: Commission points match referral counts
SELECT 'Check 2.3: Commission Calculation Consistency' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' partners with incorrect commission') 
    END as 'Result'
FROM (
    SELECT 
        p.user_id,
        p.commission_points,
        COALESCE(COUNT(r.id) * 10.00, 0) as expected_points
    FROM Partners p
    LEFT JOIN Referrals r ON p.user_id = r.partner_user_id
    GROUP BY p.user_id, p.commission_points
    HAVING p.commission_points != COALESCE(COUNT(r.id) * 10.00, 0)
) as inconsistent_commissions;

-- Check 2.4: Shift hours calculated correctly
SELECT 'Check 2.4: Shift Hours Consistency' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' shifts with incorrect hours') 
    END as 'Result'
FROM Staff_Shifts
WHERE logout_at IS NOT NULL
AND ABS(total_hours - (TIMESTAMPDIFF(MINUTE, login_at, logout_at) / 60.0)) > 0.01;

-- =====================================================
-- SECTION 3: JSON FIELD VALIDATION
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 3: JSON FIELD VALIDATION' as '';
SELECT @divider as '';

-- Check 3.1: Passport info is valid JSON
SELECT 'Check 3.1: Passport Info JSON Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' patients with invalid passport JSON') 
    END as 'Result'
FROM Patients 
WHERE passport_info IS NOT NULL 
AND NOT JSON_VALID(passport_info);

-- Check 3.2: Insurance info is valid JSON
SELECT 'Check 3.2: Insurance Info JSON Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' patients with invalid insurance JSON') 
    END as 'Result'
FROM Patients 
WHERE insurance_info IS NOT NULL 
AND NOT JSON_VALID(insurance_info);

-- Check 3.3: Contact info is valid JSON
SELECT 'Check 3.3: Contact Info JSON Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' external entities with invalid contact JSON') 
    END as 'Result'
FROM External_Entities 
WHERE contact_info IS NOT NULL 
AND NOT JSON_VALID(contact_info);

-- Check 3.4: Staff permissions is valid JSON
SELECT 'Check 3.4: Staff Permissions JSON Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' staff with invalid permissions JSON') 
    END as 'Result'
FROM Staff_Members 
WHERE permissions IS NOT NULL 
AND NOT JSON_VALID(permissions);

-- =====================================================
-- SECTION 4: ENUM VALUE VALIDATION
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 4: ENUM VALUE VALIDATION' as '';
SELECT @divider as '';

-- Check 4.1: User roles are valid
SELECT 'Check 4.1: User Role Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' users with invalid role') 
    END as 'Result'
FROM Users 
WHERE role NOT IN ('patient', 'partner', 'staff', 'admin', 'super_admin');

-- Check 4.2: Appointment statuses are valid
SELECT 'Check 4.2: Appointment Status Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' appointments with invalid status') 
    END as 'Result'
FROM Appointments 
WHERE status NOT IN ('scheduled', 'checked_in', 'completed', 'cancelled');

-- Check 4.3: Invoice statuses are valid
SELECT 'Check 4.3: Invoice Status Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' invoices with invalid status') 
    END as 'Result'
FROM Invoices 
WHERE status NOT IN ('pending', 'paid', 'partially_paid', 'overdue', 'cancelled');

-- Check 4.4: Payment methods are valid
SELECT 'Check 4.4: Payment Method Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' invoices with invalid payment method') 
    END as 'Result'
FROM Invoices 
WHERE payment_method NOT IN ('cash', 'card', 'insurance_credit', 'bank_transfer');

-- Check 4.5: Document types are valid
SELECT 'Check 4.5: Document Type Validity' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' documents with invalid type') 
    END as 'Result'
FROM Documents 
WHERE type NOT IN ('passport', 'insurance_card', 'test_result', 'diagnosis_card', 'lab_report', 'invoice', 'instruction_card', 'insurance_agreement', 'other');

-- =====================================================
-- SECTION 5: DATE CONSTRAINT VALIDATION
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 5: DATE CONSTRAINT VALIDATION' as '';
SELECT @divider as '';

-- Check 5.1: Scheduled appointments shouldn't be in past
SELECT 'Check 5.1: Future Scheduled Appointments' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('WARNING - ', COUNT(*), ' scheduled appointments in past (may need status update)') 
    END as 'Result'
FROM Appointments 
WHERE status = 'scheduled' 
AND appointment_datetime < NOW();

-- Check 5.2: Insurance credit invoices have due dates
SELECT 'Check 5.2: Insurance Invoices Have Due Dates' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' insurance invoices missing due_date') 
    END as 'Result'
FROM Invoices 
WHERE payment_method = 'insurance_credit' 
AND status != 'paid'
AND due_date IS NULL;

-- Check 5.3: Expired passports (warning, not error)
SELECT 'Check 5.3: Expired Passports (Information)' as 'Test';
SELECT 
    CONCAT('INFO - ', COUNT(*), ' patients with expired passports') as 'Result'
FROM Patients p 
WHERE p.passport_info IS NOT NULL 
AND JSON_VALID(p.passport_info)
AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(p.passport_info, '$.expiryDate')), '%Y-%m-%d') < CURDATE();

-- Check 5.4: Overdue invoices should have correct status
SELECT 'Check 5.4: Overdue Invoice Status' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('WARNING - ', COUNT(*), ' invoices past due_date without overdue status') 
    END as 'Result'
FROM Invoices 
WHERE due_date IS NOT NULL
AND due_date < CURDATE()
AND status NOT IN ('paid', 'overdue', 'cancelled');

-- =====================================================
-- SECTION 6: INDEX USAGE ANALYSIS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 6: INDEX USAGE ANALYSIS (Run EXPLAIN manually)' as '';
SELECT @divider as '';

-- Note: Run these EXPLAIN queries manually to analyze index usage

-- Query 6.1: Appointment query by patient
-- EXPLAIN SELECT * FROM Appointments WHERE patient_user_id = 1 AND status = 'scheduled' ORDER BY appointment_datetime;

-- Query 6.2: Invoice query by patient and status
-- EXPLAIN SELECT * FROM Invoices WHERE patient_user_id = 1 AND status = 'pending';

-- Query 6.3: Audit log query by date range
-- EXPLAIN SELECT * FROM Audit_Logs WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY timestamp DESC;

-- Query 6.4: Document query by patient
-- EXPLAIN SELECT * FROM Documents WHERE patient_user_id = 1 AND type = 'passport';

SELECT 'INDEX USAGE: Run EXPLAIN queries manually to verify index usage' as 'Note';

-- =====================================================
-- SECTION 7: CASCADE BEHAVIOR TESTS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 7: CASCADE BEHAVIOR TESTS (Manual Test Required)' as '';
SELECT @divider as '';

SELECT 'CASCADE TESTS: Must be run manually in test environment' as 'Note';
SELECT 'DO NOT RUN CASCADE DELETE TESTS IN PRODUCTION' as 'WARNING';

-- =====================================================
-- SECTION 8: DUPLICATE DETECTION
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 8: DUPLICATE DETECTION' as '';
SELECT @divider as '';

-- Check 8.1: Duplicate referrals
SELECT 'Check 8.1: Duplicate Referrals' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' duplicate referral pairs found') 
    END as 'Result'
FROM (
    SELECT partner_user_id, patient_user_id, COUNT(*) as dup_count
    FROM Referrals 
    GROUP BY partner_user_id, patient_user_id 
    HAVING COUNT(*) > 1
) as duplicates;

-- Check 8.2: Duplicate invoice numbers
SELECT 'Check 8.2: Duplicate Invoice Numbers' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' duplicate invoice numbers found') 
    END as 'Result'
FROM (
    SELECT invoice_number, COUNT(*) as dup_count
    FROM Invoices 
    GROUP BY invoice_number 
    HAVING COUNT(*) > 1
) as duplicates;

-- Check 8.3: Duplicate email addresses
SELECT 'Check 8.3: Duplicate Email Addresses' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE CONCAT('FAIL - ', COUNT(*), ' duplicate emails found') 
    END as 'Result'
FROM (
    SELECT email, COUNT(*) as dup_count
    FROM Users 
    WHERE deleted_at IS NULL
    GROUP BY email 
    HAVING COUNT(*) > 1
) as duplicates;

-- =====================================================
-- SECTION 9: PERFORMANCE CHECKS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 9: PERFORMANCE CHECKS' as '';
SELECT @divider as '';

-- Check 9.1: Table sizes
SELECT 'Check 9.1: Table Sizes' as 'Test';
SELECT 
    table_name,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
    table_rows
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
AND table_name IN (
    'Users', 'Patients', 'Partners', 'Staff_Members', 'Referrals',
    'Appointments', 'Documents', 'Services', 'Invoices', 'Invoice_Items',
    'Payments', 'Staff_Shifts', 'External_Entities', 'Accounts_Payable', 'Audit_Logs'
)
ORDER BY (data_length + index_length) DESC;

-- Check 9.2: Active Queries
-- NOTE: This check requires PROCESS privilege
-- If you get "Access denied" error, see database-validation-admin.sql
SELECT 'Check 9.2: Active Queries (requires PROCESS privilege)' as 'Test';
-- Commented out: Requires PROCESS privilege which most application users don't have
-- Uncomment only if running with admin/root privileges
-- SELECT 
--     id, 
--     user, 
--     host, 
--     db, 
--     command, 
--     time, 
--     state, 
--     LEFT(info, 100) as query_start
-- FROM information_schema.PROCESSLIST 
-- WHERE command != 'Sleep'
-- AND time > 1
-- ORDER BY time DESC;

-- =====================================================
-- SECTION 10: PWA-POS COMPATIBILITY CHECKS
-- =====================================================
SELECT @divider as '';
SELECT 'SECTION 10: PWA-POS COMPATIBILITY CHECKS' as '';
SELECT @divider as '';

-- Check 10.1: All shared tables exist
SELECT 'Check 10.1: Shared Tables Existence' as 'Test';
SELECT 
    CASE 
        WHEN COUNT(*) = 13 THEN 'PASS - All 13 shared tables exist' 
        ELSE CONCAT('FAIL - Only ', COUNT(*), ' of 13 shared tables found') 
    END as 'Result'
FROM information_schema.TABLES 
WHERE table_schema = DATABASE()
AND table_name IN (
    'Users', 'Patients', 'Staff_Members', 'Appointments', 
    'Documents', 'Services', 'Invoices', 'Invoice_Items', 
    'Payments', 'Staff_Shifts', 'External_Entities', 
    'Accounts_Payable', 'Audit_Logs'
);

-- List all shared tables
SELECT table_name
FROM information_schema.TABLES 
WHERE table_schema = DATABASE()
AND table_name IN (
    'Users', 'Patients', 'Staff_Members', 'Appointments', 
    'Documents', 'Services', 'Invoices', 'Invoice_Items', 
    'Payments', 'Staff_Shifts', 'External_Entities', 
    'Accounts_Payable', 'Audit_Logs'
)
ORDER BY table_name;

-- =====================================================
-- SUMMARY REPORT
-- =====================================================
SELECT @divider as '';
SELECT 'VALIDATION SUMMARY' as '';
SELECT @divider as '';

SELECT 'Total checks completed: 30+' as 'Summary';
SELECT 'Review all FAIL results above' as 'Action Required';
SELECT 'Address WARNING items as needed' as 'Recommended Action';
SELECT 'INFO items are for awareness only' as 'Note';

SELECT @divider as '';
SELECT 'End of Validation Script' as '';
SELECT @divider as '';
