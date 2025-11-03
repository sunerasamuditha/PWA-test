# WeCare PWA - API Test Collection

This document provides comprehensive API endpoint documentation with example requests and responses for all WeCare PWA endpoints.

## Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [Patient Endpoints](#patient-endpoints)
3. [Partner Endpoints](#partner-endpoints)
4. [Document Endpoints](#document-endpoints)
5. [Invoice & Payment Endpoints](#invoice--payment-endpoints)
6. [Appointment Endpoints](#appointment-endpoints)
7. [Admin Endpoints](#admin-endpoints)
8. [Audit Log Endpoints](#audit-log-endpoints)

---

## Authentication Endpoints

### 1. POST /api/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "patient@example.com",
  "password": "SecurePass@123",
  "full_name": "John Doe",
  "phone_number": "1234567890",
  "role": "patient",
  "referredBy": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 1,
      "email": "patient@example.com",
      "fullName": "John Doe",
      "role": "patient",
      "isActive": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Rules:**
- Email: Must be valid email format, unique
- Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- Phone: 10 digits, unique
- Role: patient, partner, staff, admin, superadmin
- ReferredBy: Optional, must be valid partner UUID (extracted from QR code or referral URL)

---

### 2. POST /api/auth/login
Authenticate user and get tokens.

**Request:**
```json
{
  "email": "patient@example.com",
  "password": "SecurePass@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "patient@example.com",
      "fullName": "John Doe",
      "role": "patient"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Rate Limiting:** 5 failed attempts → 429 Too Many Requests

---

### 3. POST /api/auth/logout
Logout user and invalidate tokens.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 4. PUT /api/auth/password-change
Change user password.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "currentPassword": "SecurePass@123",
  "newPassword": "NewSecure@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 5. GET /api/auth/profile
Get current user profile.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "patient@example.com",
      "fullName": "John Doe",
      "phoneNumber": "1234567890",
      "role": "patient",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 6. PUT /api/auth/profile
Update user profile.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "full_name": "Jane Doe",
  "phone_number": "9876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "patient@example.com",
      "fullName": "Jane Doe",
      "phoneNumber": "9876543210"
    }
  }
}
```

---

## Patient Endpoints

### 1. GET /api/patients/me
Get current patient profile with health data.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": 1,
      "userId": 1,
      "dateOfBirth": "1990-05-15",
      "gender": "male",
      "bloodGroup": "O+",
      "allergies": "Penicillin",
      "chronicConditions": "Diabetes",
      "currentMedications": "Metformin",
      "passportInfo": {
        "number": "ABC123456",
        "country": "USA",
        "expiryDate": "2030-12-31"
      },
      "insuranceInfo": {
        "provider": "HealthCare Inc",
        "policyNumber": "POL123456",
        "expiryDate": "2025-12-31"
      }
    }
  }
}
```

**Note:** Passport number and insurance policy number are encrypted in database.

---

### 2. PUT /api/patients/me
Update patient profile.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "date_of_birth": "1990-05-15",
  "gender": "male",
  "blood_group": "O+",
  "allergies": "Penicillin, Peanuts",
  "chronic_conditions": "Type 2 Diabetes",
  "current_medications": "Metformin 500mg",
  "passport_info": {
    "number": "NEW789012",
    "country": "Canada",
    "expiryDate": "2032-06-30"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Patient profile updated successfully",
  "data": {
    "patient": {
      "id": 1,
      "userId": 1,
      "dateOfBirth": "1990-05-15",
      "gender": "male",
      "bloodGroup": "O+",
      "allergies": "Penicillin, Peanuts",
      "chronicConditions": "Type 2 Diabetes",
      "currentMedications": "Metformin 500mg"
    }
  }
}
```

---

### 3. GET /api/patients/health-history
Get patient health history timeline.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": 1,
        "type": "appointment",
        "date": "2024-01-20T14:00:00.000Z",
        "description": "General Checkup",
        "doctor": "Dr. Smith"
      },
      {
        "id": 2,
        "type": "document",
        "date": "2024-01-21T10:30:00.000Z",
        "description": "Lab Results - Blood Test",
        "fileUrl": "/uploads/1/blood-test.pdf"
      }
    ]
  }
}
```

---

## Partner Endpoints

### 1. GET /api/partners/me
Get partner profile with referral statistics.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "email": "partner@example.com",
      "fullName": "HealthCare Partners",
      "role": "partner"
    },
    "partner": {
      "type": "clinic",
      "status": "active",
      "commissionPoints": 250,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-20T14:45:00.000Z"
    }
  }
}
```

---

### 2. GET /api/partners/me/qrcode
Generate or retrieve partner QR code.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUh...",
    "referralUrl": "https://wecare.com/register?ref=abc123def456",
    "partnerUuid": "abc123def456"
  }
}
```

---

### 3. GET /api/partners/me/referrals
Get partner referrals list.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- status: pending, completed, cancelled
- page: 1
- limit: 20

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": 1,
        "patient_name": "John Doe",
        "referred_at": "2024-01-15T10:30:00.000Z",
        "status": "completed",
        "commission_amount": 10.00
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 25,
      "itemsPerPage": 20
    }
  }
}
```

---

## Document Endpoints

### 1. POST /api/documents/upload
Upload patient document.

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Form Data:**
- document: [file] (PDF, PNG, JPG, JPEG - max 10MB)
- type: passport, insurance_card, test_result, diagnosis_card, lab_report, invoice, instruction_card, insurance_agreement, other

**Response (201):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "document": {
      "id": 1,
      "userId": 1,
      "type": "lab_report",
      "fileName": "blood-test.pdf",
      "filePath": "/uploads/1/blood-test-1642512345.pdf",
      "fileSize": 245678,
      "mimeType": "application/pdf",
      "uploadedAt": "2024-01-20T10:30:00.000Z"
    }
  }
}
```

---

### 2. GET /api/documents
List user documents.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- type: passport, insurance_card, test_result, diagnosis_card, lab_report, invoice, instruction_card, insurance_agreement, other
- page: 1
- limit: 20

**Response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 1,
        "type": "lab_report",
        "fileName": "blood-test.pdf",
        "fileSize": 245678,
        "uploadedAt": "2024-01-20T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 5,
      "itemsPerPage": 20
    }
  }
}
```

---

### 3. GET /api/documents/:id
Get specific document details.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "document": {
      "id": 1,
      "type": "lab_report",
      "fileName": "blood-test.pdf",
      "fileSize": 245678,
      "mimeType": "application/pdf",
      "uploadedAt": "2024-01-20T10:30:00.000Z"
    }
  }
}
```

---

### 4. GET /api/documents/:id/download
Download document.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
- Content-Type: application/pdf (or appropriate MIME type)
- Content-Disposition: attachment; filename="blood-test.pdf"
- [Binary file data]

---

### 4. GET /api/documents/:id/preview
Preview document (images/PDFs).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
- Content-Type: image/png or application/pdf
- [Binary file data for inline display]

---

### 5. DELETE /api/documents/:id
Delete document.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

### 6. GET /api/documents/gallery
Get documents grouped by type for gallery view.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "gallery": {
      "labReport": [
        { "id": 1, "fileName": "blood-test.pdf", "thumbnail": "/thumb/1.png" }
      ],
      "passport": [
        { "id": 2, "fileName": "passport.jpg", "thumbnail": "/thumb/2.jpg" }
      ]
    }
  }
}
```

---

## Invoice & Payment Endpoints

### 1. POST /api/invoices
Create new invoice (staff/admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "patient_user_id": 1,
  "invoice_type": "opd",
  "payment_method": "cash",
  "due_date": "2024-02-15",
  "items": [
    {
      "description": "Consultation Fee",
      "quantity": 1,
      "unit_price": 50.00
    },
    {
      "description": "Lab Tests",
      "quantity": 3,
      "unit_price": 25.00
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Invoice WC-2024-0001 created successfully",
  "data": {
    "invoice": {
      "id": 1,
      "invoice_number": "WC-2024-0001",
      "patient_user_id": 1,
      "invoice_type": "opd",
      "total_amount": 125.00,
      "paid_amount": 0.00,
      "balance": 125.00,
      "status": "pending",
      "due_date": "2024-02-15",
      "items": [ /* invoice items */ ]
    }
  }
}
```

---

### 2. GET /api/invoices
List invoices (filtered by role).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- status: pending, paid, overdue, cancelled
- patient_user_id: filter by patient (staff/admin only)
- page: 1
- limit: 20

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": 1,
        "invoiceNumber": "WC-2024-0001",
        "totalAmount": 125.00,
        "paidAmount": 0.00,
        "balance": 125.00,
        "status": "pending",
        "createdAt": "2024-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 10,
      "itemsPerPage": 20
    }
  }
}
```

---

### 3. POST /api/payments
Record payment (staff/admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "invoice_id": 1,
  "amount": 125.00,
  "payment_method": "card",
  "transaction_id": "TXN20240120001"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "id": 1,
      "invoiceId": 1,
      "amount": 125.00,
      "paymentMethod": "card",
      "transactionId": "TXN20240120001",
      "recordedAt": "2024-01-20T11:00:00.000Z"
    },
    "invoice": {
      "id": 1,
      "paidAmount": 125.00,
      "balance": 0.00,
      "status": "paid"
    }
  }
}
```

---

### 4. GET /api/invoices/:id/payments
Get payment history for invoice.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "amount": 50.00,
        "paymentMethod": "cash",
        "paymentDate": "2024-01-20T10:00:00.000Z"
      },
      {
        "id": 2,
        "amount": 75.00,
        "paymentMethod": "card",
        "paymentDate": "2024-01-21T15:00:00.000Z"
      }
    ],
    "totalPaid": 125.00,
    "balance": 0.00
  }
}
```

---

## Appointment Endpoints

### 1. POST /api/appointments
Book new appointment.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "appointment_date": "2024-02-15T14:00:00.000Z",
  "appointment_type": "consultation",
  "reason": "General checkup"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointment": {
      "id": 1,
      "patientUserId": 1,
      "appointmentDate": "2024-02-15T14:00:00.000Z",
      "appointmentType": "consultation",
      "status": "scheduled",
      "reason": "General checkup"
    }
  }
}
```

---

### 2. GET /api/appointments
List appointments.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- status: scheduled, completed, cancelled
- date: 2024-02-15
- page: 1
- limit: 20

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": 1,
        "appointmentDate": "2024-02-15T14:00:00.000Z",
        "appointmentType": "consultation",
        "status": "scheduled",
        "patientName": "John Doe"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 5,
      "itemsPerPage": 20
    }
  }
}
```

---

## Admin Endpoints

### 1. GET /api/admin/users
List all users (admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- role: patient, partner, staff, admin
- is_active: true, false
- page: 1
- limit: 50

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "email": "user@example.com",
        "fullName": "John Doe",
        "role": "patient",
        "isActive": true,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 100,
      "itemsPerPage": 50
    }
  }
}
```

---

### 2. PUT /api/admin/users/:id/role
Change user role (admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "role": "staff"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "user": {
      "id": 1,
      "role": "staff"
    }
  }
}
```

---

### 3. PUT /api/admin/users/:id/status
Activate/deactivate user (admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "is_active": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "user": {
      "id": 1,
      "isActive": false
    }
  }
}
```

---

### 4. GET /api/admin/reports/revenue
Get revenue report (admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- start_date: 2024-01-01
- end_date: 2024-01-31
- groupBy: day, week, month

**Response (200):**
```json
{
  "success": true,
  "data": {
    "report": {
      "totalRevenue": 15000.00,
      "totalInvoices": 120,
      "paidInvoices": 100,
      "pendingInvoices": 20,
      "breakdown": [
        {
          "date": "2024-01-01",
          "revenue": 500.00,
          "invoices": 5
        }
      ]
    }
  }
}
```

---

## Audit Log Endpoints

### 1. GET /api/admin/audit-logs
Get audit logs (admin only).

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- user_id: filter by user
- action: filter by action type
- start_date: 2024-01-01
- end_date: 2024-01-31
- page: 1
- limit: 50

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "userId": 5,
        "action": "user_login",
        "details": "Login successful",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-01-20T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 500,
      "itemsPerPage": 50
    }
  }
}
```

---

## Common Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation error or invalid request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens are obtained via `/api/auth/login` or `/api/auth/register` endpoints.

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Login Attempts:** 5 failed attempts → 429 response with 15-minute lockout
- **API Requests:** 100 requests per 15 minutes per user/IP
- **Document Uploads:** 20 uploads per hour per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets
- `Retry-After`: Seconds to wait before retrying (on 429)

---

## Testing with Postman

1. Import collection: Use these endpoints to create a Postman collection
2. Environment variables:
   - `baseUrl`: http://localhost:3000
   - `accessToken`: {{login.response.accessToken}}
   - `userId`: {{login.response.user.id}}
3. Authorization: Use collection-level Bearer token authentication
4. Tests: Add test scripts to validate response status, structure, and data

---

## Version History

- **v1.0.0** - Initial API release (Phase 14)
- All endpoints are currently at v1

