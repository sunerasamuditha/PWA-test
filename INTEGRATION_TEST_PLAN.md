# Integration Test Plan

This document outlines the comprehensive integration testing strategy for WeCare PWA, focusing on database integration, API integration, service integration, and external system integration.

## Overview

Integration tests verify that different components of the system work together correctly:
- Database operations and transactions
- API endpoint chains and workflows
- Service layer interactions
- External service integrations (if applicable)

---

## 1. Database Integration Tests

### 1.1 Connection and Pool Management
**Test**: Database connection pooling works correctly
- Verify connection pool initialized with correct settings
- Test concurrent database queries (50+ simultaneous)
- Verify connections are released after use
- Test connection pool exhaustion handling

**Test**: Transaction handling
- Test COMMIT on successful operations
- Test ROLLBACK on errors
- Test nested transactions (if supported)
- Test transaction isolation levels

### 1.2 Foreign Key Constraints
**Test**: Cascade delete operations
- Delete user → verify patients/partners/staff deleted
- Delete invoice → verify invoice_items deleted
- Delete appointment → verify related records cleaned up

**Test**: Referential integrity
- Attempt to insert referral with non-existent partner_user_id → should fail
- Attempt to insert appointment with non-existent patient_user_id → should fail
- Verify orphaned record prevention

### 1.3 Data Consistency
**Test**: Invoice and payment consistency
- Create invoice with total $100
- Record payment $60 → verify invoice status remains 'pending', balance $40
- Record payment $40 → verify invoice status changes to 'paid', balance $0
- Verify paid_amount calculated correctly

**Test**: Partner commission consistency
- Partner refers 3 patients → commission_points should be exactly 30
- Verify Referrals table matches Partners.commission_points
- Test concurrent referrals maintain consistency

---

## 2. API Integration Tests

### 2.1 Authentication Flow Integration
**Test**: Complete registration → login → profile update workflow
```javascript
test('full authentication workflow', async () => {
  // 1. Register
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, ... });
  expect(registerRes.status).toBe(201);
  const accessToken = registerRes.body.accessToken;
  
  // 2. Get profile
  const profileRes = await request(app)
    .get('/api/auth/profile')
    .set('Authorization', `Bearer ${accessToken}`);
  expect(profileRes.status).toBe(200);
  
  // 3. Update profile
  const updateRes = await request(app)
    .put('/api/auth/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ full_name: 'Updated Name' });
  expect(updateRes.status).toBe(200);
});
```

### 2.2 Document Upload → Download Workflow
**Test**: Upload → list → download → delete
- Upload document → verify 201 created
- List documents → verify new document in list
- Download document → verify file content matches upload
- Delete document → verify file removed from list and filesystem

### 2.3 Appointment → Invoice → Payment Workflow
**Test**: Book appointment → create invoice → record payment
- Patient books appointment
- Staff creates invoice for appointment
- Staff records payment
- Verify appointment, invoice, payment records linked correctly

---

## 3. Service Layer Integration

### 3.1 Encryption Service Integration
**Test**: Encrypt passport → store → retrieve → decrypt
```javascript
test('encryption service integration', async () => {
  const passportNumber = 'P123456789';
  
  // Encrypt and store
  const encrypted = encryptField(passportNumber);
  await executeQuery('INSERT INTO Patients (passport_info) VALUES (?)', [JSON.stringify({ number: encrypted })]);
  
  // Retrieve and decrypt
  const [rows] = await executeQuery('SELECT passport_info FROM Patients WHERE id = ?', [id]);
  const decrypted = decryptField(JSON.parse(rows[0].passport_info).number);
  
  expect(decrypted).toBe(passportNumber);
});
```

### 3.2 QR Code Generation Service
**Test**: Generate QR → scan → register with referral
- Partner requests QR code generation
- Service generates QR with embedded referral code
- Patient scans QR, extracts referral parameter
- Patient registers with referral → commission awarded

### 3.3 Audit Logging Service
**Test**: All sensitive operations logged
- Perform user registration → verify audit log entry
- Perform password change → verify audit log entry
- Perform document upload → verify audit log entry
- Query audit logs → verify entries retrievable

---

## 4. Multi-Table Operations

### 4.1 User Creation with Role-Specific Records
**Test**: Register patient → verify Users + Patients created
```javascript
test('patient registration creates both user and patient records', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email, password, role: 'patient', ... });
  
  const userId = response.body.user.id;
  
  // Verify User record
  const [users] = await executeQuery('SELECT * FROM Users WHERE id = ?', [userId]);
  expect(users.length).toBe(1);
  expect(users[0].role).toBe('patient');
  
  // Verify Patient record created
  const [patients] = await executeQuery('SELECT * FROM Patients WHERE user_id = ?', [userId]);
  expect(patients.length).toBe(1);
});
```

### 4.2 Invoice with Items
**Test**: Create invoice → verify invoice + items inserted atomically
- Create invoice with 3 items
- Verify Invoices record created with correct total
- Verify 3 Invoice_Items records created
- Verify sum of item total_price matches invoice total_amount

---

## 5. Access Control Integration

### 5.1 Patient Data Isolation
**Test**: Patient A cannot access Patient B's data
- Login as Patient A
- Attempt to GET Patient B's profile → 403
- Attempt to GET Patient B's documents → 403
- Attempt to GET Patient B's appointments → 403

### 5.2 Staff Permission Validation
**Test**: Staff with limited permissions
- Create staff with only `manage_appointments` permission
- Test accessing appointments endpoints → 200 OK
- Test accessing invoices endpoints → 403 Forbidden
- Test accessing documents endpoints → 403 Forbidden

---

## 6. Error Handling Integration

### 6.1 Database Error Propagation
**Test**: Database errors return appropriate HTTP status
- Attempt duplicate email registration → 400 Bad Request
- Attempt to insert with missing required field → 500 Internal Server Error
- Attempt to violate FK constraint → 400 Bad Request

### 6.2 Validation Error Integration
**Test**: Multi-layer validation
- Client validation (frontend)
- API validation (express-validator)
- Database validation (constraints)
- Verify error messages consistent across layers

---

## 7. Pagination and Filtering Integration

### 7.1 Paginated List Endpoints
**Test**: List documents with pagination
- Create 25 documents
- GET /api/documents?page=1&limit=10 → verify 10 results, page 1
- GET /api/documents?page=2&limit=10 → verify 10 results, page 2
- GET /api/documents?page=3&limit=10 → verify 5 results, page 3
- Verify `total`, `page`, `totalPages` metadata correct

### 7.2 Filtered List Endpoints
**Test**: Filter documents by type
- Upload 5 passports, 3 insurance cards, 2 lab reports
- GET /api/documents?type=passport → verify 5 results
- GET /api/documents?type=insurance_card → verify 3 results
- Verify filtering + pagination combined

---

## 8. PWA-POS Database Sharing

### 8.1 Shared Table Validation
**Test**: PWA and POS can both access shared tables
- Insert record via PWA → verify readable by POS queries
- Insert record via POS → verify readable by PWA queries
- Test concurrent writes from both systems
- Verify no table locking issues

### 8.2 Connection Pool Sharing
**Test**: 20 connections per system respected
- Simulate 20 concurrent PWA queries
- Simulate 20 concurrent POS queries
- Verify no connection exhaustion errors
- Verify both systems can operate simultaneously

---

## 9. Performance Integration Tests

### 9.1 Large Dataset Operations
**Test**: Pagination performance with 10,000 records
- Insert 10,000 documents for a patient
- Query with pagination → verify response time < 200ms
- Test different page numbers (page 1, 50, 100)
- Verify consistent performance

### 9.2 Complex Join Queries
**Test**: Invoice with items and payment history
- Create invoice with 10 items, 5 payments
- GET /api/invoices/:id with full details
- Verify response time < 100ms
- Verify data completeness

---

## 10. Audit and Compliance Integration

### 10.1 GDPR Data Export
**Test**: Export all patient data
- Request patient data export
- Verify includes: profile, appointments, documents, invoices
- Verify sensitive data is decrypted in export
- Verify export format (JSON/CSV)

### 10.2 Audit Trail Completeness
**Test**: All user actions logged
- Perform series of operations (10 different actions)
- Query audit logs → verify 10 entries
- Verify each entry has: user_id, action, details, ip_address, timestamp
- Verify logs are immutable (cannot be deleted/modified)

---

## Test Execution

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Database Integration Tests
```bash
npm test -- --grep "Database Integration"
```

### Run API Integration Tests
```bash
npm test -- --grep "API Integration"
```

### Run Service Integration Tests
```bash
npm test -- --grep "Service.*Integration"
```

---

## Success Criteria

### Database Integration
- [ ] All FK constraints enforced
- [ ] Transactions commit/rollback correctly
- [ ] No orphaned records
- [ ] Connection pooling stable under load

### API Integration
- [ ] All workflows complete successfully
- [ ] Error handling consistent
- [ ] Access control enforced at all layers
- [ ] Pagination/filtering works correctly

### Service Integration
- [ ] Encryption/decryption bidirectional
- [ ] QR code generation functional
- [ ] Audit logging captures all events
- [ ] Commission calculation accurate

### Performance
- [ ] Response times within SLA (< 200ms for reads, < 500ms for writes)
- [ ] No N+1 query problems
- [ ] Connection pool efficient
- [ ] Large datasets paginated correctly

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Connection pool exhausted"
- **Fix**: Ensure connections released after use (use `finally` blocks)
- **Fix**: Increase pool size in test config

**Issue**: Foreign key constraint violations
- **Fix**: Ensure data seeded in correct order (Users → Patients → Appointments)
- **Fix**: Use `truncateAllTables()` to clean state between tests

**Issue**: Inconsistent test results
- **Fix**: Ensure proper test isolation (rollback transactions or truncate tables)
- **Fix**: Avoid global state mutation

---

**Version**: 1.0  
**Last Updated**: Phase 14

