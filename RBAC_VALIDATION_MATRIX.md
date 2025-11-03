# RBAC Validation Matrix

## Role-Based Access Control (RBAC) System

This document defines the complete permissions matrix for the WeCare PWA system across all five user roles.

---

## User Roles

| Role | Code | Description |
|------|------|-------------|
| Patient | `patient` | End users seeking medical services |
| Partner | `partner` | Referral partners (guides, agents, hospitals, clinics) |
| Staff | `staff` | Hospital staff (front desk, nurses, pharmacists, lab technicians) |
| Admin | `admin` | System administrators |
| Super Admin | `super_admin` | System owners with full access |

---

## Permissions Matrix

### Authentication & Profile Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| Register account | ✅ | ✅ | ❌ | ❌ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ | ✅ | ✅ |
| Refresh token | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete own account | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### Patient Data Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View own patient profile | ✅ (own) | ❌ | ❌ | ✅ (all) | ✅ (all) |
| Update own patient profile | ✅ (own) | ❌ | ❌ | ❌ | ✅ (all) |
| View other patient profiles | ❌ | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |
| Update other patient profiles | ❌ | ❌ | ❌ | ✅ (all) | ✅ (all) |
| List all patients | ❌ | ❌ | ✅ | ✅ | ✅ |
| Search patients | ❌ | ❌ | ✅ | ✅ | ✅ |
| View patient health history | ✅ (own) | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |
| Export patient data | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### Partner & Referral Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View own partner profile | ❌ | ✅ (own) | ❌ | ✅ (all) | ✅ (all) |
| Update own partner profile | ❌ | ✅ (own) | ❌ | ❌ | ✅ (all) |
| Generate QR code | ❌ | ✅ (own) | ❌ | ❌ | ❌ |
| View own referrals | ❌ | ✅ (own) | ❌ | ✅ (all) | ✅ (all) |
| View referral statistics | ❌ | ✅ (own) | ❌ | ✅ (all) | ✅ (all) |
| View commission points | ❌ | ✅ (own) | ❌ | ✅ (all) | ✅ (all) |
| Redeem commission | ❌ | ✅ (own) | ❌ | ❌ | ✅ |
| Update partner status | ❌ | ❌ | ❌ | ✅ | ✅ |
| List all partners | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create referral manually | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### Staff Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View own staff profile | ❌ | ❌ | ✅ (own) | ✅ (all) | ✅ (all) |
| Update own staff profile | ❌ | ❌ | ✅ (own) | ❌ | ✅ (all) |
| View staff shifts | ❌ | ❌ | ✅ (own) | ✅ (all) | ✅ (all) |
| Create staff shift | ❌ | ❌ | ✅ (auto) | ✅ | ✅ |
| End staff shift | ❌ | ❌ | ✅ (own) | ✅ (all) | ✅ (all) |
| View staff permissions | ❌ | ❌ | ✅ (own) | ✅ (all) | ✅ (all) |
| Update staff permissions | ❌ | ❌ | ❌ | ✅ | ✅ |
| List all staff | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### Appointment Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| Create own appointment | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own appointments | ✅ (own) | ❌ | ❌ | ✅ (all) | ✅ (all) |
| Update own appointment | ✅ (own) | ❌ | ❌ | ❌ | ❌ |
| Cancel own appointment | ✅ (own) | ❌ | ❌ | ❌ | ❌ |
| Create patient appointment | ❌ | ❌ | ✅ | ✅ | ✅ |
| View all appointments | ❌ | ❌ | ✅ | ✅ | ✅ |
| Update appointment status | ❌ | ❌ | ✅ | ✅ | ✅ |
| Cancel any appointment | ❌ | ❌ | ✅ | ✅ | ✅ |
| View calendar | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reschedule appointment | ✅ (own) | ❌ | ✅ (all) | ✅ (all) | ✅ (all) |

---

### Document Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| Upload own document | ✅ (own) | ❌ | ❌ | ❌ | ❌ |
| View own documents | ✅ (own) | ❌ | ❌ | ✅ (all) | ✅ (all) |
| Download own document | ✅ (own) | ❌ | ❌ | ✅ (all) | ✅ (all) |
| Delete own document | ✅ (own) | ❌ | ❌ | ❌ | ✅ (all) |
| Upload patient document | ❌ | ❌ | ✅ | ✅ | ✅ |
| View patient documents | ❌ | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |
| Download patient document | ❌ | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |
| Delete patient document | ❌ | ❌ | ❌ | ✅ | ✅ |
| View document gallery | ✅ (own) | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |

---

### Billing & Invoice Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View own invoices | ✅ (own) | ❌ | ❌ | ✅ (all) | ✅ (all) |
| Create invoice | ❌ | ❌ | ✅ | ✅ | ✅ |
| Update invoice | ❌ | ❌ | ✅ (pending) | ✅ (all) | ✅ (all) |
| Cancel invoice | ❌ | ❌ | ❌ | ✅ | ✅ |
| View invoice details | ✅ (own) | ❌ | ✅ (all) | ✅ (all) | ✅ (all) |
| Record payment | ❌ | ❌ | ✅ | ✅ | ✅ |
| View payment history | ✅ (own) | ❌ | ✅ (all) | ✅ (all) | ✅ (all) |
| Generate invoice report | ❌ | ❌ | ❌ | ✅ | ✅ |
| Mark invoice overdue | ❌ | ❌ | ✅ | ✅ | ✅ |

---

### Service Management

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View services list | ✅ | ✅ | ✅ | ✅ | ✅ |
| View service details | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create service | ❌ | ❌ | ❌ | ✅ | ✅ |
| Update service | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete service | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update service pricing | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### User Management (Admin Functions)

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| List all users | ❌ | ❌ | ❌ | ✅ | ✅ |
| View user details | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create user | ❌ | ❌ | ❌ | ✅ | ✅ |
| Update user role | ❌ | ❌ | ❌ | ✅ | ✅ |
| Activate/deactivate user | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete user | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reset user password | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### Audit Logs

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View own audit logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| View all audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Search audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete audit logs | ❌ | ❌ | ❌ | ❌ | ❌ (never) |

---

### Reports & Analytics

| Resource/Action | Patient | Partner | Staff | Admin | Super Admin |
|----------------|---------|---------|-------|-------|-------------|
| View patient count | ❌ | ❌ | ✅ | ✅ | ✅ |
| View appointment statistics | ❌ | ❌ | ✅ | ✅ | ✅ |
| View revenue reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| View commission reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| View dashboard | ❌ | ✅ (partner) | ✅ | ✅ | ✅ |

---

## Permission Codes

For staff members, the `permissions` JSON field in `Staff_Members` table contains granular permissions:

### Available Staff Permissions

```json
{
  "permissions": [
    "manage_appointments",
    "manage_documents",
    "view_patients",
    "view_health_records",
    "manage_invoices",
    "record_payments",
    "view_reports",
    "manage_shifts"
  ]
}
```

### Permission Mapping by Staff Role

| Staff Role | Default Permissions |
|------------|---------------------|
| **Front Desk** | `manage_appointments`, `manage_documents`, `view_patients` |
| **Nurse** | `manage_appointments`, `manage_documents`, `view_health_records` |
| **Pharmacist** | `manage_invoices`, `view_patients` |
| **Lab Technician** | `manage_documents`, `view_health_records` |

---

## Access Control Implementation

### Middleware Stack

```
Request → Authentication → Role Check → Permission Check → Resource Ownership → Route Handler
```

### 1. Authentication (`auth.js`)
- Verify JWT token
- Extract user ID, role
- Attach to `req.user`

### 2. Role Check
```javascript
requireRole(['admin', 'super_admin'])
```

### 3. Permission Check (for staff)
```javascript
requirePermission('manage_appointments')
```

### 4. Resource Ownership
```javascript
requireOwnership('patient') // Can only access own data
```

---

## Test Cases for RBAC

### Patient Role Tests
- ✅ Patient can view own profile
- ✅ Patient cannot view other patient profiles
- ✅ Patient can create own appointments
- ✅ Patient cannot access admin routes
- ✅ Patient can upload own documents

### Partner Role Tests
- ✅ Partner can generate QR code
- ✅ Partner can view own referrals
- ✅ Partner cannot access patient data
- ✅ Partner cannot create invoices

### Staff Role Tests
- ✅ Staff can view assigned patients
- ✅ Staff can manage appointments
- ✅ Staff permissions validated
- ✅ Staff cannot delete users

### Admin Role Tests
- ✅ Admin can access all resources
- ✅ Admin can manage users
- ✅ Admin can view reports
- ✅ Admin cannot delete audit logs

### Super Admin Role Tests
- ✅ Super admin has full access
- ✅ Super admin can delete resources
- ✅ Super admin can modify any data

---

## Security Considerations

### Role Escalation Prevention
- Users cannot change their own role
- Role changes require admin authentication
- Role changes are audit logged

### Resource Ownership Validation
- Always verify resource belongs to user
- Use parameterized queries
- Validate user ID matches resource owner

### Permission Caching
- Permissions loaded once per request
- Cached in JWT token
- Refreshed on token renewal

---

## API Endpoint Authorization

### Public Endpoints (No Auth Required)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/services` (read-only)

### Patient Endpoints
- `GET /api/patients/me`
- `PUT /api/patients/me`
- `GET /api/patients/me/health-history`
- `POST /api/appointments`
- `POST /api/documents/upload`

### Partner Endpoints
- `GET /api/partners/me`
- `GET /api/partners/me/qrcode`
- `GET /api/partners/me/referrals`

### Staff Endpoints
- `GET /api/patients`
- `GET /api/appointments`
- `POST /api/appointments`
- `PUT /api/appointments/:id`
- `POST /api/invoices`

### Admin Endpoints
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `GET /api/admin/audit-logs`
- `GET /api/admin/reports/*`

### Super Admin Endpoints
- `DELETE /api/admin/users/:id`
- `DELETE /api/admin/audit-logs/:id` (NEVER - audit logs are immutable)
- All admin endpoints

---

## Validation Script

Run RBAC validation tests:
```bash
npm run test:security -- rbac.test.js
```

This validates:
- ✅ All role permissions enforced
- ✅ Cross-role access blocked
- ✅ Resource ownership validated
- ✅ Permission escalation prevented
- ✅ Audit logs created for sensitive actions
