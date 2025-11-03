# Workflow Validation Scenarios

This document outlines comprehensive end-to-end workflow validation scenarios for the WeCare PWA. Each workflow represents a complete user journey through the system.

## Table of Contents
1. [Patient Registration & Onboarding](#1-patient-registration--onboarding)
2. [QR Code Referral Workflow](#2-qr-code-referral-workflow)
3. [Document Management Workflow](#3-document-management-workflow)
4. [Appointment Booking & Management](#4-appointment-booking--management)
5. [Invoice Creation & Payment](#5-invoice-creation--payment)
6. [Partner Commission Tracking](#6-partner-commission-tracking)
7. [Admin User Management](#7-admin-user-management)
8. [Health History Timeline](#8-health-history-timeline)
9. [Multi-Role Access Control](#9-multi-role-access-control)
10. [Audit Trail Verification](#10-audit-trail-verification)

---

## 1. Patient Registration & Onboarding

### Workflow Description
A new patient creates an account, completes their profile, and uploads required documents.

### Prerequisites
- None (new user)

### Steps

#### Step 1: Register Account
**Action:** POST /api/auth/register
```json
{
  "email": "newpatient@example.com",
  "password": "SecurePass@123",
  "full_name": "Jane Smith",
  "phone_number": "1234567890",
  "role": "patient"
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ User record created in Users table
- ✅ Patient record created in Patients table
- ✅ Access token and refresh token returned
- ✅ Audit log entry: "user_registration"

#### Step 2: Login
**Action:** POST /api/auth/login
```json
{
  "email": "newpatient@example.com",
  "password": "SecurePass@123"
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ User object with role "patient" returned
- ✅ New access token issued
- ✅ Audit log entry: "user_login"

#### Step 3: Complete Profile
**Action:** PUT /api/patients/me
```json
{
  "date_of_birth": "1990-05-15",
  "gender": "female",
  "blood_group": "A+",
  "allergies": "None",
  "passport_info": {
    "number": "P12345678",
    "country": "USA",
    "expiryDate": "2030-12-31"
  }
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ Patient profile updated
- ✅ Passport number encrypted in database
- ✅ Audit log entry: "sensitive_data_update"

#### Step 4: Upload Documents
**Action:** POST /api/documents/upload (multipart/form-data)
- File: passport.jpg
- Type: passport

**Expected Result:**
- ✅ Status 201 Created
- ✅ File saved to uploads/{user_id}/passport-{timestamp}.jpg
- ✅ Document record created in Documents table
- ✅ File size < 10MB validated
- ✅ MIME type validated (image/jpeg)
- ✅ Audit log entry: "document_upload"

### Success Criteria
- [ ] Patient can register and login successfully
- [ ] Profile is complete with encrypted sensitive data
- [ ] Documents are uploaded and accessible
- [ ] All actions are audit logged
- [ ] User receives proper authentication tokens

---

## 2. QR Code Referral Workflow

### Workflow Description
A partner generates a QR code, a new patient registers using the QR code, and the partner earns commission.

### Prerequisites
- Partner account exists

### Steps

#### Step 1: Partner Generates QR Code
**Action:** GET /api/partners/qr-code (as partner)

**Expected Result:**
- ✅ Status 200 OK
- ✅ QR code image returned (base64 PNG)
- ✅ Referral URL contains partner user ID
- ✅ QR code stored in Partners table

#### Step 2: Patient Scans QR Code
**Action:** User scans QR code, opens registration page with referral parameter

**Expected Result:**
- ✅ Registration form pre-filled with referredBy parameter
- ✅ Referral URL format: /register?ref={partner_user_id}

#### Step 3: Patient Registers with Referral
**Action:** POST /api/auth/register
```json
{
  "email": "referred@example.com",
  "password": "SecurePass@123",
  "full_name": "Referred Patient",
  "phone_number": "9876543210",
  "role": "patient",
  "referredBy": "{partner_user_id}"
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ Patient account created
- ✅ Referral record created in Referrals table
- ✅ Referral status: "converted"
- ✅ Audit log entry: "referral_creation"

#### Step 4: Commission Updated
**Action:** Automatic (triggered by successful registration)

**Expected Result:**
- ✅ Partner commission_points increased by 10
- ✅ Partner total_referrals count increased by 1
- ✅ Audit log entry: "commission_update" with details "+10 points"

#### Step 5: Partner Views Referrals
**Action:** GET /api/partners/referrals (as partner)

**Expected Result:**
- ✅ Status 200 OK
- ✅ Referral list includes new patient
- ✅ Referral shows "converted" status
- ✅ Commission earned: 10 points

### Success Criteria
- [ ] Partner can generate QR code successfully
- [ ] Patient registration with referral link works
- [ ] Referral record is created automatically
- [ ] Partner receives exactly 10 commission points
- [ ] All events are audit logged
- [ ] Partner can view referral in dashboard

---

## 3. Document Management Workflow

### Workflow Description
A patient uploads various medical documents, views them in a gallery, downloads specific files, and deletes outdated documents.

### Prerequisites
- Patient account exists and is logged in

### Steps

#### Step 1: Upload Multiple Documents
**Action:** POST /api/documents/upload (repeat for each document)
- Document 1: passport.pdf (type: passport)
- Document 2: insurance.pdf (type: insurance)
- Document 3: lab-results.pdf (type: lab_result)
- Document 4: xray.jpg (type: xray)

**Expected Result:**
- ✅ All 4 documents uploaded successfully (Status 201 each)
- ✅ Files stored in uploads/{user_id}/ directory
- ✅ Document records created in Documents table
- ✅ File size validated (<10MB each)
- ✅ MIME types validated (PDF/JPG)
- ✅ 4 audit log entries: "document_upload"

#### Step 2: View Document Gallery
**Action:** GET /api/documents/gallery (as patient)

**Expected Result:**
- ✅ Status 200 OK
- ✅ Documents grouped by type:
  - passport: [passport.pdf]
  - insurance: [insurance.pdf]
  - lab_result: [lab-results.pdf]
  - xray: [xray.jpg]
- ✅ Thumbnails available for images

#### Step 3: List Documents with Filtering
**Action:** GET /api/documents?type=lab_result

**Expected Result:**
- ✅ Status 200 OK
- ✅ Only lab_result documents returned
- ✅ Pagination metadata included

#### Step 4: Preview Document
**Action:** GET /api/documents/{xray_id}/preview

**Expected Result:**
- ✅ Status 200 OK
- ✅ Content-Type: image/jpeg
- ✅ Image data returned for inline display
- ✅ No download prompt (inline display)

#### Step 5: Download Document
**Action:** GET /api/documents/{passport_id}/download

**Expected Result:**
- ✅ Status 200 OK
- ✅ Content-Type: application/pdf
- ✅ Content-Disposition: attachment; filename="passport.pdf"
- ✅ File downloaded
- ✅ Audit log entry: "document_download"

#### Step 6: Delete Outdated Document
**Action:** DELETE /api/documents/{old_document_id}

**Expected Result:**
- ✅ Status 200 OK
- ✅ Document record deleted from database
- ✅ Physical file removed from uploads directory
- ✅ Audit log entry: "document_deletion"

#### Step 7: Verify Access Control
**Action:** Another patient attempts to access this patient's document
GET /api/documents/{patient1_document_id} (as patient2)

**Expected Result:**
- ✅ Status 403 Forbidden
- ✅ Error: "Unauthorized access to document"
- ✅ Document not returned

### Success Criteria
- [ ] All document types can be uploaded successfully
- [ ] Gallery view groups documents by type correctly
- [ ] Filtering and pagination work properly
- [ ] Preview displays images/PDFs inline
- [ ] Download provides files with correct headers
- [ ] Deletion removes both DB record and file
- [ ] Access control prevents unauthorized access
- [ ] All operations are audit logged

---

## 4. Appointment Booking & Management

### Workflow Description
A patient books an appointment, views upcoming appointments, and staff manages the appointment status.

### Prerequisites
- Patient account exists
- Staff account exists

### Steps

#### Step 1: Patient Books Appointment
**Action:** POST /api/appointments (as patient)
```json
{
  "appointment_date": "2024-03-15T14:00:00.000Z",
  "appointment_type": "consultation",
  "reason": "Annual checkup"
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ Appointment record created with status "scheduled"
- ✅ Patient user ID associated
- ✅ Audit log entry: "appointment_created"

#### Step 2: Patient Views Appointments
**Action:** GET /api/appointments (as patient)

**Expected Result:**
- ✅ Status 200 OK
- ✅ List includes newly created appointment
- ✅ Only patient's own appointments visible
- ✅ Appointment details complete

#### Step 3: Patient Views Appointment Details
**Action:** GET /api/appointments/{appointment_id} (as patient)

**Expected Result:**
- ✅ Status 200 OK
- ✅ Full appointment details returned
- ✅ Status: "scheduled"

#### Step 4: Staff Views All Appointments
**Action:** GET /api/appointments (as staff)

**Expected Result:**
- ✅ Status 200 OK
- ✅ All appointments visible (not just own)
- ✅ Can filter by date, patient, status

#### Step 5: Staff Marks Appointment as Completed
**Action:** PUT /api/appointments/{appointment_id}/status (as staff)
```json
{
  "status": "completed",
  "notes": "Patient examined, no issues found"
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ Appointment status updated to "completed"
- ✅ Notes saved
- ✅ Audit log entry: "appointment_completed"

#### Step 6: Patient Cancels Future Appointment
**Action:** PUT /api/appointments/{future_appointment_id}/cancel (as patient)

**Expected Result:**
- ✅ Status 200 OK
- ✅ Appointment status changed to "cancelled"
- ✅ Audit log entry: "appointment_cancelled"

### Success Criteria
- [ ] Patients can book appointments successfully
- [ ] Patients see only their own appointments
- [ ] Staff can view all appointments
- [ ] Staff can update appointment status
- [ ] Status transitions are valid (scheduled → completed/cancelled)
- [ ] All operations are audit logged

---

## 5. Invoice Creation & Payment

### Workflow Description
Staff creates an invoice for a patient, patient views the invoice, and staff records payments (partial and full).

### Prerequisites
- Patient account exists
- Staff account exists with manage_invoices permission

### Steps

#### Step 1: Staff Creates Invoice
**Action:** POST /api/invoices (as staff)
```json
{
  "patient_user_id": 1,
  "invoice_type": "opd",
  "payment_method": "cash",
  "items": [
    {
      "description": "Consultation Fee",
      "quantity": 1,
      "unit_price": 50.00
    },
    {
      "description": "Lab Tests",
      "quantity": 3,
      "unit_price": 30.00
    }
  ]
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ Invoice number generated: "WC-2024-XXXX"
- ✅ Total calculated: 50 + (3 × 30) = 140.00
- ✅ Status: "pending"
- ✅ Balance: 140.00
- ✅ Invoice items saved
- ✅ Audit log entry: "invoice_created"

#### Step 2: Patient Views Invoice
**Action:** GET /api/invoices (as patient)

**Expected Result:**
- ✅ Status 200 OK
- ✅ Patient sees own invoices only
- ✅ Invoice details complete
- ✅ Status: "pending"
- ✅ Balance: 140.00

#### Step 3: Staff Records Partial Payment
**Action:** POST /api/payments (as staff)
```json
{
  "invoice_id": 1,
  "amount": 50.00,
  "payment_method": "cash",
  "transaction_id": "TXN001"
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ Payment record created
- ✅ Invoice paid_amount: 50.00
- ✅ Invoice balance: 90.00
- ✅ Invoice status: still "pending" (not fully paid)
- ✅ Audit log entry: "payment_recorded"

#### Step 4: Staff Records Second Payment
**Action:** POST /api/payments (as staff)
```json
{
  "invoice_id": 1,
  "amount": 90.00,
  "payment_method": "card",
  "transaction_id": "TXN002"
}
```

**Expected Result:**
- ✅ Status 201 Created
- ✅ Invoice paid_amount: 140.00
- ✅ Invoice balance: 0.00
- ✅ Invoice status: "paid" (fully paid)
- ✅ Audit log entry: "payment_recorded"

#### Step 5: View Payment History
**Action:** GET /api/invoices/{invoice_id}/payments

**Expected Result:**
- ✅ Status 200 OK
- ✅ 2 payment records returned
- ✅ Total paid: 140.00
- ✅ Balance: 0.00

#### Step 6: Attempt Payment Exceeding Invoice Total
**Action:** POST /api/payments (with amount > balance)

**Expected Result:**
- ✅ Status 400 Bad Request
- ✅ Error: "Payment amount exceeds invoice balance"
- ✅ No payment recorded

### Success Criteria
- [ ] Staff can create invoices with multiple items
- [ ] Invoice number is unique and follows format WC-YYYY-NNNN
- [ ] Total is calculated correctly (quantity × unit_price)
- [ ] Patients can view own invoices only
- [ ] Partial payments are supported
- [ ] Invoice status updates to "paid" when fully paid
- [ ] Payment exceeding invoice is rejected
- [ ] Payment history is complete and accurate
- [ ] All operations are audit logged

---

## 6. Partner Commission Tracking

### Workflow Description
A partner refers multiple patients and tracks commission accumulation.

### Prerequisites
- Partner account exists

### Steps

#### Step 1: Partner Generates QR Code
**Action:** GET /api/partners/qr-code

**Expected Result:**
- ✅ QR code generated with unique referral URL

#### Step 2: First Patient Registers with Referral
**Action:** POST /api/auth/register (referredBy: partner_user_id)

**Expected Result:**
- ✅ Patient registered
- ✅ Partner commission: +10 points (total: 10)
- ✅ Partner total_referrals: 1

#### Step 3: Second Patient Registers with Referral
**Action:** POST /api/auth/register (referredBy: partner_user_id)

**Expected Result:**
- ✅ Patient registered
- ✅ Partner commission: +10 points (total: 20)
- ✅ Partner total_referrals: 2

#### Step 4: Partner Views Profile
**Action:** GET /api/partners/me

**Expected Result:**
- ✅ commission_points: 20
- ✅ total_referrals: 2
- ✅ active_referrals: 2

#### Step 5: Partner Views Referral List
**Action:** GET /api/partners/referrals

**Expected Result:**
- ✅ 2 referrals listed
- ✅ Both show status "converted"
- ✅ Each shows commission_earned: 10

#### Step 6: Partner Filters Referrals
**Action:** GET /api/partners/referrals?status=converted

**Expected Result:**
- ✅ Both referrals returned
- ✅ Filtering works correctly

### Success Criteria
- [ ] Each successful referral adds exactly 10 commission points
- [ ] Commission updates are atomic (no race conditions)
- [ ] total_referrals count is accurate
- [ ] Referral list matches commission total
- [ ] Filtering and pagination work correctly
- [ ] Commission updates are audit logged

---

## 7. Admin User Management

### Workflow Description
An admin manages users: views all users, changes roles, activates/deactivates accounts.

### Prerequisites
- Admin account exists
- Multiple user accounts exist (patient, partner, staff)

### Steps

#### Step 1: Admin Views All Users
**Action:** GET /api/admin/users

**Expected Result:**
- ✅ Status 200 OK
- ✅ All users visible regardless of role
- ✅ User details include role, status, created_at

#### Step 2: Admin Filters by Role
**Action:** GET /api/admin/users?role=patient

**Expected Result:**
- ✅ Only patients returned
- ✅ Filtering works correctly

#### Step 3: Admin Changes User Role
**Action:** PUT /api/admin/users/{patient_id}/role
```json
{
  "role": "staff"
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ User role updated to "staff"
- ✅ Staff record created (if needed)
- ✅ Audit log entry: "role_change"

#### Step 4: Admin Deactivates User
**Action:** PUT /api/admin/users/{user_id}/status
```json
{
  "is_active": false
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ User is_active set to false
- ✅ User cannot login
- ✅ Audit log entry: "user_deactivation"

#### Step 5: Deactivated User Attempts Login
**Action:** POST /api/auth/login (as deactivated user)

**Expected Result:**
- ✅ Status 403 Forbidden
- ✅ Error: "Account is deactivated"
- ✅ No token issued

#### Step 6: Admin Reactivates User
**Action:** PUT /api/admin/users/{user_id}/status
```json
{
  "is_active": true
}
```

**Expected Result:**
- ✅ Status 200 OK
- ✅ User can login again
- ✅ Audit log entry: "user_activation"

#### Step 7: Non-Admin Attempts User Management
**Action:** GET /api/admin/users (as patient)

**Expected Result:**
- ✅ Status 403 Forbidden
- ✅ Error: "Insufficient permissions"

### Success Criteria
- [ ] Admin can view all users
- [ ] Filtering by role and status works
- [ ] Role changes are applied correctly
- [ ] Deactivated users cannot login
- [ ] Reactivation restores access
- [ ] Non-admins cannot access admin endpoints
- [ ] All admin actions are audit logged

---

## 8. Health History Timeline

### Workflow Description
A patient views their comprehensive health history timeline including appointments, documents, and medical records.

### Prerequisites
- Patient account with existing data:
  - 2 completed appointments
  - 3 uploaded documents
  - 1 active prescription

### Steps

#### Step 1: Patient Views Timeline
**Action:** GET /api/patients/health-history

**Expected Result:**
- ✅ Status 200 OK
- ✅ Timeline includes all events chronologically
- ✅ Events grouped by type: appointment, document, prescription

#### Step 2: Filter Timeline by Date Range
**Action:** GET /api/patients/health-history?start_date=2024-01-01&end_date=2024-01-31

**Expected Result:**
- ✅ Only events within date range returned
- ✅ Chronological order maintained

#### Step 3: Filter Timeline by Type
**Action:** GET /api/patients/health-history?type=appointment

**Expected Result:**
- ✅ Only appointment events returned
- ✅ Document and prescription events excluded

#### Step 4: View Detailed Event
**Action:** GET /api/appointments/{appointment_id} (from timeline)

**Expected Result:**
- ✅ Full appointment details retrieved
- ✅ Notes and diagnosis included

### Success Criteria
- [ ] Timeline displays all relevant health events
- [ ] Events are in chronological order
- [ ] Date filtering works correctly
- [ ] Type filtering works correctly
- [ ] Each event links to detailed view
- [ ] Timeline updates when new events occur

---

## 9. Multi-Role Access Control

### Workflow Description
Verify role-based access control across all 5 user roles.

### Prerequisites
- One account for each role: patient, partner, staff, admin, superadmin

### Steps

#### Step 1: Patient Access Control
**Action:** Various API calls as patient

**Expected Results:**
- ✅ Can access own profile: GET /api/patients/me → 200
- ✅ Can access own documents: GET /api/documents → 200
- ✅ Cannot access other patients: GET /api/patients/{other_id} → 403
- ✅ Cannot access admin routes: GET /api/admin/users → 403
- ✅ Cannot create invoices: POST /api/invoices → 403

#### Step 2: Partner Access Control
**Action:** Various API calls as partner

**Expected Results:**
- ✅ Can generate QR code: GET /api/partners/qr-code → 200
- ✅ Can view referrals: GET /api/partners/referrals → 200
- ✅ Cannot access patient data: GET /api/patients/{id} → 403
- ✅ Cannot create invoices: POST /api/invoices → 403

#### Step 3: Staff Access Control
**Action:** Various API calls as staff

**Expected Results:**
- ✅ Can view patients: GET /api/patients → 200 (if has permission)
- ✅ Can create invoices: POST /api/invoices → 201 (if has permission)
- ✅ Can manage appointments: PUT /api/appointments/{id} → 200
- ✅ Cannot access admin routes: GET /api/admin/users → 403
- ✅ Permissions array controls access

#### Step 4: Admin Access Control
**Action:** Various API calls as admin

**Expected Results:**
- ✅ Can view all users: GET /api/admin/users → 200
- ✅ Can change roles: PUT /api/admin/users/{id}/role → 200
- ✅ Can view audit logs: GET /api/admin/audit-logs → 200
- ✅ Can access reports: GET /api/admin/reports/revenue → 200
- ✅ Cannot delete users: DELETE /api/admin/users/{id} → 403

#### Step 5: Super Admin Access Control
**Action:** Various API calls as superadmin

**Expected Results:**
- ✅ Full access to all resources
- ✅ Can delete users: DELETE /api/admin/users/{id} → 200
- ✅ Cannot delete audit logs: DELETE /api/admin/audit-logs/{id} → 403

### Success Criteria
- [ ] Each role has appropriate access level
- [ ] Patients can only access own data
- [ ] Partners cannot access patient data
- [ ] Staff permissions are granular
- [ ] Admins can manage users but not delete
- [ ] Super admins have full access except audit log deletion
- [ ] 403 errors returned for unauthorized access

---

## 10. Audit Trail Verification

### Workflow Description
Verify that all critical operations are properly audit logged and logs are immutable.

### Prerequisites
- Admin account exists
- Various user actions have been performed

### Steps

#### Step 1: Admin Views Audit Logs
**Action:** GET /api/admin/audit-logs

**Expected Result:**
- ✅ Status 200 OK
- ✅ Audit logs list returned
- ✅ Logs include: user_id, action, details, ip_address, user_agent, created_at

#### Step 2: Verify Critical Actions Logged
**Action:** Query audit logs for specific actions

**Expected Actions Logged:**
- ✅ user_registration
- ✅ user_login
- ✅ user_logout
- ✅ password_change
- ✅ role_change
- ✅ user_activation/deactivation
- ✅ referral_creation
- ✅ commission_update
- ✅ invoice_creation
- ✅ payment_recorded
- ✅ document_upload
- ✅ document_download
- ✅ document_deletion
- ✅ sensitive_data_update

#### Step 3: Filter Logs by User
**Action:** GET /api/admin/audit-logs?user_id={patient_id}

**Expected Result:**
- ✅ Only logs for specified user returned
- ✅ All actions by that user visible

#### Step 4: Filter Logs by Date Range
**Action:** GET /api/admin/audit-logs?start_date=2024-01-01&end_date=2024-01-31

**Expected Result:**
- ✅ Only logs within date range returned
- ✅ Timestamps are accurate

#### Step 5: Attempt to Delete Audit Log
**Action:** DELETE /api/admin/audit-logs/{log_id} (as superadmin)

**Expected Result:**
- ✅ Status 403 Forbidden
- ✅ Error: "Audit logs are immutable and cannot be deleted"
- ✅ Log remains in database

#### Step 6: Attempt to Modify Audit Log
**Action:** PUT /api/admin/audit-logs/{log_id} (as superadmin)

**Expected Result:**
- ✅ Status 403 Forbidden
- ✅ Error: "Audit logs cannot be modified"

#### Step 7: Verify IP and User Agent Logged
**Action:** Check recent audit log entry

**Expected Result:**
- ✅ ip_address field populated
- ✅ user_agent field populated
- ✅ Values match request headers

### Success Criteria
- [ ] All critical operations are audit logged
- [ ] Logs contain all required fields
- [ ] Logs are filterable by user, date, action
- [ ] Audit logs are immutable (cannot be deleted or modified)
- [ ] IP addresses and user agents are recorded
- [ ] Timestamps are accurate
- [ ] Non-admins cannot access audit logs

---

## Test Execution Checklist

Before marking Phase 14 as complete, execute ALL workflows above and verify:

- [ ] All API endpoints respond with expected status codes
- [ ] All database records are created/updated correctly
- [ ] All validations work properly (data types, required fields, constraints)
- [ ] All access control rules are enforced
- [ ] All audit logging is complete and accurate
- [ ] All file uploads/downloads work correctly
- [ ] All calculations are accurate (invoice totals, commission points)
- [ ] All email/SMS notifications are sent (if applicable)
- [ ] No memory leaks or performance issues
- [ ] Error handling is appropriate and informative

---

## Automated Test Coverage

These workflows are implemented as automated tests in:

- `server/tests/workflows/qr-referral.test.js`
- `server/tests/workflows/document-management.test.js`
- `server/tests/workflows/invoice-payment.test.js`
- `server/tests/api/auth.test.js`
- `server/tests/api/patients.test.js`
- `server/tests/security/rbac.test.js`
- `server/tests/audit/audit-coverage.test.js`

Run all tests:
```bash
npm test
```

Run specific workflow:
```bash
npm test -- workflows/qr-referral.test.js
```

---

## Manual Testing Notes

When performing manual testing:

1. **Use Real Data**: Test with realistic names, addresses, phone numbers
2. **Test Edge Cases**: Try boundary values, empty strings, null values
3. **Test Concurrency**: Open multiple browser tabs, perform simultaneous actions
4. **Test Different Devices**: Desktop, tablet, mobile browsers
5. **Test Network Conditions**: Slow 3G, offline, reconnection
6. **Test Browser Compatibility**: Chrome, Firefox, Safari, Edge
7. **Verify UI/UX**: Check loading states, error messages, success notifications
8. **Check Performance**: Monitor response times, page load speed
9. **Verify Security**: Inspect network requests, check for sensitive data exposure
10. **Test Accessibility**: Keyboard navigation, screen reader compatibility

---

## Version History

- **v1.0.0** - Initial workflow validation scenarios (Phase 14)

