# Commission Validation Guide

This document outlines the rules, validation steps, and test cases for the partner commission system in WeCare PWA.

## Commission Rules

### Base Commission Structure
- **Fixed Commission**: 10 points per successful referral
- **Referral Conversion**: Partner earns commission when referred patient completes registration
- **Commission Type**: Points-based system (can be converted to monetary value)

### Business Rules
1. **Referral Validity**:
   - Patient must register using partner's unique QR code or referral link containing UUID
   - QR code/link format: `${CLIENT_URL}/register?ref=${partnerUuid}` where partnerUuid is the partner's unique UUID
   - Registration must be completed successfully (account created and activated)
   - Patient email must be unique (no duplicate registrations)

2. **Commission Accrual**:
   - Commission is awarded immediately upon patient registration completion
   - Commission is non-reversible once awarded
   - Commission points accumulate in partner's `commission_points` field

3. **Partner Eligibility**:
   - Partner must have active status (`status = 'active'`)
   - Partner account must not be deactivated during referral
   - Partner must be of role `partner`

4. **Referral Tracking**:
   - Each referral creates a record in `Referrals` table
   - Referral links partner (`partner_user_id`) to patient (`patient_user_id`)
   - Partner identified by UUID (not numeric ID) for security
   - Commission amount recorded: `commission_amount = 10.00`
   - Status tracked: `pending` → `completed` → `cancelled`

---

## SQL Validation Checks

### Check 1: Verify Commission Calculation
```sql
-- Validate that all completed referrals have correct commission amount
SELECT 
    r.id,
    r.partner_user_id,
    r.patient_user_id,
    r.commission_amount,
    r.status
FROM Referrals r
WHERE r.status = 'completed'
  AND r.commission_amount <> 10.00;
-- Expected: 0 rows (all completed referrals should have 10.00 commission)
```

### Check 2: Verify Partner Commission Total
```sql
-- Validate partner total commission matches sum of referral commissions
SELECT 
    p.user_id,
    p.commission_points as partner_total,
    COALESCE(SUM(r.commission_amount), 0) as referral_sum,
    (p.commission_points - COALESCE(SUM(r.commission_amount), 0)) as difference
FROM Partners p
LEFT JOIN Referrals r ON p.user_id = r.partner_user_id AND r.status = 'completed'
GROUP BY p.user_id, p.commission_points
HAVING ABS(p.commission_points - COALESCE(SUM(r.commission_amount), 0)) > 0.01;
-- Expected: 0 rows (partner commission should match sum of referrals)
```

### Check 3: Verify No Duplicate Referrals
```sql
-- Check for duplicate referrals (same patient referred by multiple partners)
SELECT 
    patient_user_id,
    COUNT(*) as referral_count,
    GROUP_CONCAT(partner_user_id) as partners
FROM Referrals
WHERE status = 'completed'
GROUP BY patient_user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (each patient can only be referred once)
```

### Check 4: Verify Referral Integrity
```sql
-- Ensure all referrals link valid users
SELECT 
    r.id,
    r.partner_user_id,
    r.patient_user_id
FROM Referrals r
LEFT JOIN Users partner ON r.partner_user_id = partner.id
LEFT JOIN Users patient ON r.patient_user_id = patient.id
WHERE partner.id IS NULL 
   OR patient.id IS NULL
   OR partner.role <> 'partner'
   OR patient.role <> 'patient';
-- Expected: 0 rows (all referrals should have valid partner and patient)
```

### Check 5: Verify Commission Consistency
```sql
-- Check that commission_amount is always 10.00 for converted referrals
SELECT 
    MIN(commission_amount) as min_commission,
    MAX(commission_amount) as max_commission,
    AVG(commission_amount) as avg_commission,
    COUNT(DISTINCT commission_amount) as unique_values
FROM Referrals
WHERE status = 'completed';
-- Expected: min=10.00, max=10.00, avg=10.00, unique_values=1
```

---

## Automated Test Cases

### Test 1: Single Referral Commission
**Scenario**: Partner refers one patient
```javascript
test('should award 10 points for single referral', async () => {
  const partner = await createTestPartner();
  const initialPoints = partner.commission_points; // 0
  
  // Patient registers with referral code
  await registerPatientWithReferral(partner.user.id);
  
  // Verify partner commission updated
  const updatedPartner = await getPartner(partner.user.id);
  expect(updatedPartner.commission_points).toBe(initialPoints + 10);
});
```

### Test 2: Multiple Referrals
**Scenario**: Partner refers multiple patients
```javascript
test('should accumulate commission for multiple referrals', async () => {
  const partner = await createTestPartner();
  
  // Register 5 patients with referral
  for (let i = 0; i < 5; i++) {
    await registerPatientWithReferral(partner.user.id);
  }
  
  // Verify total commission
  const updatedPartner = await getPartner(partner.user.id);
  expect(updatedPartner.commission_points).toBe(50); // 5 × 10
});
```

### Test 3: Concurrent Referrals
**Scenario**: Multiple patients register simultaneously
```javascript
test('should handle concurrent referrals without race conditions', async () => {
  const partner = await createTestPartner();
  
  // Simulate concurrent registrations
  await Promise.all([
    registerPatientWithReferral(partner.user.id),
    registerPatientWithReferral(partner.user.id),
    registerPatientWithReferral(partner.user.id)
  ]);
  
  // Verify commission is exactly 30 (not less due to race condition)
  const updatedPartner = await getPartner(partner.user.id);
  expect(updatedPartner.commission_points).toBe(30);
});
```

### Test 4: Invalid Referral Code
**Scenario**: Patient uses invalid referral code
```javascript
test('should reject invalid referral code', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'test@example.com',
      password: 'Test@123',
      referredBy: '99999' // Non-existent partner ID
    });
  
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('referral');
});
```

### Test 5: Deactivated Partner
**Scenario**: Patient tries to use deactivated partner's code
```javascript
test('should reject referral from deactivated partner', async () => {
  const partner = await createTestPartner({ status: 'inactive' });
  
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'test@example.com',
      password: 'Test@123',
      referredBy: partner.user.id
    });
  
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('partner not active');
});
```

---

## Manual Validation Steps

### Step 1: Test QR Code Generation
1. Login as partner
2. Navigate to referral dashboard
3. Click "Generate QR Code"
4. Verify QR code displays correctly
5. Scan QR code with mobile device
6. Verify it opens registration page with referral parameter

### Step 2: Test Referral Registration
1. Open registration page from QR code link
2. Verify referral field is pre-filled
3. Complete registration form
4. Submit registration
5. Verify account created successfully
6. Check partner dashboard for new referral

### Step 3: Verify Commission Award
1. Login as partner
2. View commission dashboard
3. Verify commission points increased by 10
4. Check referral list shows new patient
5. Verify referral status is "completed"

### Step 4: Test Database Integrity
1. Run SQL validation checks above
2. Verify all checks return 0 rows (no errors)
3. Compare partner `commission_points` with referral sum
4. Check for any orphaned referral records

### Step 5: Test Edge Cases
1. Test duplicate email registration (should fail)
2. Test expired referral link (if applicable)
3. Test referral limit per partner (if applicable)
4. Test commission cap (if applicable)

---

## Performance Benchmarks

### Target Metrics
- **Commission Update Time**: < 100ms per referral
- **QR Code Generation**: < 500ms
- **Concurrent Registrations**: Support 10 simultaneous without errors
- **Database Query Time**: < 50ms for commission calculation

### Load Testing
```bash
# Simulate 100 concurrent referral registrations
npm run test:load -- --scenario=referrals --concurrent=100
```

---

## Troubleshooting

### Issue: Commission Not Awarded
**Symptoms**: Patient registered but partner commission unchanged
**Diagnosis**:
1. Check Referrals table for record
2. Verify referral status (should be 'completed')
3. Check audit logs for commission update event
4. Verify partner status is 'active'

**Resolution**:
- If referral record missing: Check registration payload
- If status not 'completed': Check registration completion logic
- If audit log missing: Check commission service

### Issue: Incorrect Commission Amount
**Symptoms**: Commission awarded but amount wrong
**Diagnosis**:
1. Run SQL Check 1 (commission calculation)
2. Check Referrals table commission_amount column
3. Verify commission rule (should be 10.00)

**Resolution**:
- Update referral commission_amount to 10.00
- Recalculate partner total: `UPDATE Partners SET commission_points = (SELECT SUM(commission_amount) FROM Referrals WHERE partner_user_id = ? AND status = 'completed')`

### Issue: Duplicate Referrals
**Symptoms**: Same patient has multiple referral records
**Diagnosis**:
1. Run SQL Check 3 (duplicate referrals)
2. Identify duplicate patient_user_id entries

**Resolution**:
- Keep only the first referral (by created_at)
- Delete duplicate referral records
- Recalculate partner commission
- Add unique constraint: `ALTER TABLE Referrals ADD UNIQUE INDEX idx_unique_patient_referral (patient_user_id)`

---

## Audit Requirements

All commission-related events must be logged to `Audit_Logs`:

### Events to Log
1. **Referral Creation**: When patient registers with referral code
2. **Commission Update**: When partner commission points increase
3. **Referral Status Change**: When referral status changes
4. **QR Code Generation**: When partner generates/regenerates QR code

### Log Format
```json
{
  "user_id": 123,
  "action": "commission_update",
  "details": "+10 points from referral #456 (patient: user_789)",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Reporting

### Partner Commission Report
```sql
SELECT 
    u.id,
    u.full_name as partner_name,
    u.email,
    p.commission_points as total_commission,
    COUNT(r.id) as total_referrals,
    SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed_referrals,
    SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_referrals
FROM Users u
INNER JOIN Partners p ON u.id = p.user_id
LEFT JOIN Referrals r ON u.id = r.partner_user_id
WHERE u.role = 'partner'
GROUP BY u.id, u.full_name, u.email, p.commission_points
ORDER BY p.commission_points DESC;
```

### Top Referrers Report
```sql
SELECT 
    u.full_name,
    COUNT(r.id) as referral_count,
    p.commission_points
FROM Users u
INNER JOIN Partners p ON u.id = p.user_id
INNER JOIN Referrals r ON u.id = r.partner_user_id
WHERE r.status = 'completed'
GROUP BY u.id, u.full_name, p.commission_points
ORDER BY referral_count DESC
LIMIT 10;
```

---

## Version History
- **v1.0.0** - Initial commission validation guide (Phase 14)


