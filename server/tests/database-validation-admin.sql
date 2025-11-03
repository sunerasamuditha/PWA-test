-- =====================================================
-- WeCare Database Admin Validation Queries
-- =====================================================
-- 
-- WARNING: This file contains queries that require elevated privileges
-- such as PROCESS, SUPER, or admin-level permissions.
-- 
-- DO NOT run these queries with application user credentials.
-- These should only be executed by database administrators
-- or users with appropriate privileges.
-- 
-- Required Privileges:
-- - PROCESS: To view PROCESSLIST and active queries
-- - SELECT on information_schema: To query system tables
-- 
-- Usage:
--   mysql -u root -p < database-validation-admin.sql
-- 
-- =====================================================

-- Set database context
USE wecare_db;

SET @divider = REPEAT('=', 80);

-- =====================================================
-- SECTION 1: ACTIVE QUERY MONITORING
-- =====================================================
SELECT @divider as '';
SELECT 'ADMIN SECTION 1: ACTIVE QUERY MONITORING (requires PROCESS privilege)' as '';
SELECT @divider as '';

-- Check 1.1: Long-running queries
SELECT 'Check 1.1: Long-Running Queries (>1 second)' as 'Test';
SELECT 
    id, 
    user, 
    host, 
    db, 
    command, 
    time as duration_seconds, 
    state, 
    LEFT(info, 100) as query_start
FROM information_schema.PROCESSLIST 
WHERE command != 'Sleep'
AND time > 1
ORDER BY time DESC;

-- Check 1.2: All active connections
SELECT 'Check 1.2: Active Database Connections' as 'Test';
SELECT 
    db,
    COUNT(*) as connection_count,
    SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active_queries
FROM information_schema.PROCESSLIST
WHERE db IS NOT NULL
GROUP BY db
ORDER BY connection_count DESC;

-- Check 1.3: Queries by user
SELECT 'Check 1.3: Active Connections by User' as 'Test';
SELECT 
    user,
    host,
    COUNT(*) as connection_count,
    SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active_queries
FROM information_schema.PROCESSLIST
GROUP BY user, host
ORDER BY connection_count DESC;

-- =====================================================
-- SECTION 2: DATABASE PERFORMANCE METRICS
-- =====================================================
SELECT @divider as '';
SELECT 'ADMIN SECTION 2: DATABASE PERFORMANCE METRICS' as '';
SELECT @divider as '';

-- Check 2.1: InnoDB buffer pool usage
SELECT 'Check 2.2: InnoDB Buffer Pool Usage' as 'Test';
SHOW STATUS LIKE 'Innodb_buffer_pool%';

-- Check 2.2: Table lock statistics
SELECT 'Check 2.2: Table Lock Statistics' as 'Test';
SHOW STATUS LIKE 'Table_locks%';

-- Check 2.3: Connection statistics
SELECT 'Check 2.3: Connection Statistics' as 'Test';
SHOW STATUS LIKE 'Connections';
SHOW STATUS LIKE 'Max_used_connections';
SHOW STATUS LIKE 'Threads_connected';

-- =====================================================
-- SECTION 3: SLOW QUERY ANALYSIS
-- =====================================================
SELECT @divider as '';
SELECT 'ADMIN SECTION 3: SLOW QUERY ANALYSIS' as '';
SELECT @divider as '';

-- Check 3.1: Slow query log status
SELECT 'Check 3.1: Slow Query Log Status' as 'Test';
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';

-- =====================================================
-- SECTION 4: USER PRIVILEGES AUDIT
-- =====================================================
SELECT @divider as '';
SELECT 'ADMIN SECTION 4: USER PRIVILEGES AUDIT' as '';
SELECT @divider as '';

-- Check 4.1: List all database users
SELECT 'Check 4.1: Database Users' as 'Test';
SELECT 
    user,
    host,
    CASE 
        WHEN password_expired = 'Y' THEN 'EXPIRED'
        ELSE 'VALID'
    END as password_status
FROM mysql.user
WHERE user != ''
ORDER BY user;

-- Check 4.2: Global privileges
SELECT 'Check 4.2: Users with Global Privileges' as 'Test';
SELECT 
    user,
    host,
    Select_priv,
    Insert_priv,
    Update_priv,
    Delete_priv,
    Create_priv,
    Drop_priv,
    Super_priv,
    Process_priv
FROM mysql.user
WHERE user != ''
ORDER BY user;

-- =====================================================
-- SECTION 5: SYSTEM HEALTH CHECKS
-- =====================================================
SELECT @divider as '';
SELECT 'ADMIN SECTION 5: SYSTEM HEALTH CHECKS' as '';
SELECT @divider as '';

-- Check 5.1: Error log warnings (if accessible)
SELECT 'Check 5.1: Recent Error Log Status' as 'Test';
-- Note: Actual error log location varies by system
-- Check your MySQL configuration for log_error variable
SHOW VARIABLES LIKE 'log_error';

-- Check 5.2: Binary log status (for replication/backup)
SELECT 'Check 5.2: Binary Logging Status' as 'Test';
SHOW VARIABLES LIKE 'log_bin';
SHOW VARIABLES LIKE 'binlog_format';

-- =====================================================
-- END OF ADMIN VALIDATION QUERIES
-- =====================================================
SELECT @divider as '';
SELECT 'Admin validation queries completed' as '';
SELECT 'Review output for any warnings or issues requiring attention' as '';
SELECT @divider as '';
