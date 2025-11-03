# API Route Alignment - Tests vs Actual Implementation

## Overview
This document maps test routes to actual server routes, identifying mismatches and required fixes.

---

## Route Mismatches Identified

### 1. Partner Routes

| Test Route | Actual Route | Status | Action Required |
|------------|--------------|--------|-----------------|
| `GET /api/partners/me/qr-code` | `GET /api/partners/qrcode` | ❌ Mismatch | Update tests to use `/qrcode` |
| `GET /api/partners/me/referrals` | `GET /api/partners/referrals` | ❌ Mismatch | Remove `/me` prefix |
| `GET /api/partners/profile` | `GET /api/partners/profile` | ✅ Match | No action |
| `PUT /api/partners/profile` | `PUT /api/partners/profile` | ✅ Match | No action |

**Fix Required**: Update `qr-referral.test.js`
```javascript
// OLD (incorrect)
.get('/api/partners/me/qr-code')
.get('/api/partners/me/referrals')

// NEW (correct)
.get('/api/partners/qrcode')
.get('/api/partners/referrals')
```

---

### 2. Document Routes

| Test Route | Actual Route | Status | Action Required |
|------------|--------------|--------|-----------------|
| `POST /api/documents/upload` | `POST /api/documents/upload` | ✅ Match | No action |
| `GET /api/documents/me` | `GET /api/documents` | ❌ Mismatch | Remove `/me`, controller filters by user |
| `GET /api/documents/me/gallery` | ❓ Not implemented | ❌ Missing | Remove from tests or implement route |
| `GET /api/documents/:id` | `GET /api/documents/:id` | ✅ Match | No action |
| `GET /api/documents/:id/download` | `GET /api/documents/:id/download` | ✅ Match | No action |
| `DELETE /api/documents/:id` | `DELETE /api/documents/:id` | ✅ Match | No action |

**Fix Required**: Update `document-management.test.js`
```javascript
// OLD (incorrect)
.get('/api/documents/me')
.get('/api/documents/me?type=passport')
.get('/api/documents/me/gallery')

// NEW (correct)
.get('/api/documents')
.get('/api/documents?type=passport')
// Remove gallery tests or implement /gallery route
```

---

### 3. Invoice Routes

| Test Route | Actual Route | Status | Action Required |
|------------|--------------|--------|-----------------|
| `POST /api/invoices` | `POST /api/invoices` | ✅ Match | No action |
| `GET /api/invoices/me` | `GET /api/invoices` | ❌ Mismatch | Remove `/me`, controller filters by user |
| `GET /api/invoices/me?status=pending` | `GET /api/invoices?status=pending` | ❌ Mismatch | Remove `/me` |
| `GET /api/invoices/:id` | `GET /api/invoices/:id` | ✅ Match | No action |
| `GET /api/invoices/my/stats` | `GET /api/invoices/my/stats` | ✅ Match | No action |
| `GET /api/invoices/stats` | `GET /api/invoices/stats` | ✅ Match | No action |

**Fix Required**: Update `invoice-payment.test.js`
```javascript
// OLD (incorrect)
.get('/api/invoices/me')
.get('/api/invoices/me?status=pending')

// NEW (correct)
.get('/api/invoices')
.get('/api/invoices?status=pending')
```

---

### 4. Payment Routes

| Test Route | Actual Route | Status | Note |
|------------|--------------|--------|------|
| `POST /api/payments` | `POST /api/payments` | ✅ Match | No action needed |
| `GET /api/payments` | `GET /api/payments` | ✅ Match | No action needed |
| `GET /api/payments/:id` | `GET /api/payments/:id` | ✅ Match | No action needed |

---

### 5. Authentication Routes

| Test Route | Actual Route | Status | Note |
|------------|--------------|--------|------|
| `POST /api/auth/register` | `POST /api/auth/register` | ✅ Match | No action needed |
| `POST /api/auth/login` | `POST /api/auth/login` | ✅ Match | No action needed |
| `POST /api/auth/logout` | `POST /api/auth/logout` | ✅ Match | No action needed |
| `POST /api/auth/refresh` | `POST /api/auth/refresh` | ✅ Match | No action needed |
| `GET /api/auth/me` | `GET /api/auth/me` | ✅ Match | No action needed |

---

## Implementation Pattern: `/me` Endpoints

**Current Pattern**: Tests use explicit `/me` routes
- `/api/documents/me`
- `/api/invoices/me`
- `/api/partners/me/qr-code`

**Actual Pattern**: Base routes with role-based filtering in controllers
- Controllers check `req.user.id` and `req.user.role`
- Return data specific to authenticated user
- No `/me` in route path needed

**Example** (from documentController.js):
```javascript
async getDocuments(req, res) {
  const userId = req.user.id;
  const role = req.user.role;
  
  // Automatically filter by user if patient
  if (role === 'patient') {
    const documents = await Document.findByUserId(userId);
    return res.json({ documents });
  }
  
  // Staff/admin can see all documents (with filters)
  // ...
}
```

---

## Recommended Route Standardization

### Option 1: Keep Current Server Implementation (Recommended)
- ✅ Simpler routes (`/api/documents`, `/api/invoices`)
- ✅ Controller handles user filtering
- ✅ RESTful convention
- ❌ Requires updating all tests

### Option 2: Add `/me` Aliases
- Add route aliases for consistency with tests:
  ```javascript
  router.get('/me', authenticate, controller.getDocuments); // Same as GET /
  router.get('/me/gallery', authenticate, controller.getGallery);
  ```
- ✅ Tests work without changes
- ❌ Duplicates routes
- ❌ Not RESTful

**Decision**: **Option 1** - Update tests to match server implementation

---

## Test Files Requiring Updates

### High Priority
1. **`qr-referral.test.js`** (18 instances)
   - Change `/api/partners/me/qr-code` → `/api/partners/qrcode`
   - Change `/api/partners/me/referrals` → `/api/partners/referrals`

2. **`document-management.test.js`** (8 instances)
   - Change `/api/documents/me` → `/api/documents`
   - Remove `/api/documents/me/gallery` tests (not implemented)

3. **`invoice-payment.test.js`** (3 instances)
   - Change `/api/invoices/me` → `/api/invoices`
   - Change `/api/invoices/me?status=...` → `/api/invoices?status=...`

### Medium Priority
4. **`patient-onboarding.test.js`**
   - Verify `/api/patients` routes align
   
5. **`appointment-booking.test.js`**
   - Verify `/api/appointments` routes align

---

## Response Shape Alignment

### Current Status
Most response shapes are consistent:
```json
{
  "status": "success",
  "data": { ... },
  "message": "..."
}
```

### Exceptions to Verify
1. **Document Upload Response**:
   - Test expects: `{ document: {...} }`
   - Server returns: `{ status, document, message }`
   
2. **Invoice Creation Response**:
   - Test expects: `{ invoice: {...} }`
   - Server returns: `{ invoice, items, total }`

3. **Error Responses**:
   - Consistent format: `{ error, code, details }`

---

## Action Items

### Immediate (This Sprint)
- [ ] Update `qr-referral.test.js` routes (Comment 5a)
- [ ] Update `document-management.test.js` routes (Comment 5b)
- [ ] Update `invoice-payment.test.js` routes (Comment 5c)
- [ ] Remove `/me/gallery` tests or implement route (Comment 5d)

### Short-Term (Next Sprint)
- [ ] Verify all response shapes match server implementation
- [ ] Update API documentation to reflect actual routes
- [ ] Add integration tests for edge cases
- [ ] Update Postman/Swagger collection

### Long-Term (Next Quarter)
- [ ] Consider OpenAPI schema for contract testing
- [ ] Implement API versioning (`/api/v1/...`)
- [ ] Add automated route validation tests

---

## Verification Checklist

After route alignment updates, verify:
- [ ] All workflow tests pass
- [ ] No 404 errors in test output
- [ ] Response assertions match actual server responses
- [ ] RBAC tests use correct protected routes
- [ ] API documentation matches actual routes
- [ ] Postman collection updated

---

**Last Updated**: 2024
**Reviewed By**: Development Team
**Status**: In Progress (9/14 verification comments complete)
