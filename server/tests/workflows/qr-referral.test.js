const request = require('supertest');
const app = require('../../src/app');
const { createTestPartner, createTestUser, truncateTable, executeQuery } = require('../setup');
const { v4: uuidv4 } = require('uuid');

describe('QR Referral Workflow End-to-End Tests', () => {
  
  let partner;
  let partnerToken;
  
  beforeEach(async () => {
    await truncateTable('Users');
    await truncateTable('Partners');
    await truncateTable('Patients');
    await truncateTable('Referrals');
    
    // Create active partner
    const partnerData = await createTestPartner({
      email: 'partner@test.com',
      full_name: 'Test Partner'
    }, {
      partner_type: 'guide',
      status: 'active',
      commission_points: 0.00
    });
    
    partner = partnerData;
    partnerToken = partner.user.accessToken;
  });
  
  describe('Complete QR Referral Flow', () => {
    
    test('should complete full referral workflow successfully', async () => {
      // Step 1: Partner generates QR code
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(qrResponse.body.data).toHaveProperty('qrCode'); // camelCase keys in data envelope
      expect(qrResponse.body.data).toHaveProperty('referralUrl');
      expect(qrResponse.body.data).toHaveProperty('partnerUuid');
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      // Step 2: Patient scans QR and gets referral code (UUID)
      // (In real scenario, QR scanner extracts UUID from QR code or referralUrl)
      expect(partnerUuid).toBeDefined();
      
      // Step 3: Patient registers with referral code (UUID)
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'referred_patient@test.com',
          password: 'Test@123456',
          full_name: 'Referred Patient',
          phone_number: '1234567890',
          role: 'patient',
          referredBy: partnerUuid // Use UUID instead of numeric ID
        })
        .expect(201);
      
      expect(registrationResponse.body).toHaveProperty('data');
      expect(registrationResponse.body.data).toHaveProperty('user');
      const patientUserId = registrationResponse.body.data.user.id;
      
      // Step 4: Verify Referral record was created
      const [referrals] = await executeQuery(
        'SELECT * FROM Referrals WHERE patient_user_id = ? AND partner_user_id = ?',
        [patientUserId, partner.user.id]
      );
      
      expect(referrals.length).toBe(1);
      expect(referrals[0].commission_amount).toBe(10.00);
      expect(referrals[0].status).toBe('completed');
      
      // Step 5: Verify partner commission points increased by 10
      const [partnerRecord] = await executeQuery(
        'SELECT commission_points FROM Partners WHERE user_id = ?',
        [partner.user.id]
      );
      
      expect(parseFloat(partnerRecord[0].commission_points)).toBe(10.00);
      
      // Step 6: Verify audit logs were created
      const [auditLogs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE user_id = ? AND action = ? AND target_entity = ?',
        [patientUserId, 'create', 'Referrals']
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
    
  });
  
  describe('QR Code Generation', () => {
    
    test('should generate QR code for active partner', async () => {
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('qrCode'); // camelCase in data envelope
      expect(response.body.data).toHaveProperty('referralUrl');
      expect(response.body.data).toHaveProperty('partnerUuid');
      expect(response.body.data.qrCode).toContain('data:image'); // QR code image
    });
    
    test('should fail for inactive partner', async () => {
      const inactivePartner = await createTestPartner({
        email: 'inactive@test.com'
      }, {
        status: 'inactive'
      });
      
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${inactivePartner.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inactive');
    });
    
    test('should fail for suspended partner', async () => {
      const suspendedPartner = await createTestPartner({
        email: 'suspended@test.com'
      }, {
        status: 'suspended'
      });
      
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${suspendedPartner.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('suspended');
    });
    
    test('should fail for non-partner role', async () => {
      const patient = await createTestUser('patient');
      
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${patient.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Patient Registration with Referral', () => {
    
    test('should create referral on patient registration', async () => {
      // First get the partner UUID from QR code endpoint
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newpatient@test.com',
          password: 'Test@123456',
          full_name: 'New Patient',
          phone_number: '9876543210',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(201);
      
      const patientUserId = response.body.data.user.id;
      
      // Verify referral created
      const [referrals] = await executeQuery(
        'SELECT * FROM Referrals WHERE patient_user_id = ?',
        [patientUserId]
      );
      
      expect(referrals.length).toBe(1);
      expect(referrals[0].partner_user_id).toBe(partner.user.id);
      expect(referrals[0].commission_amount).toBe(10.00);
    });
    
    test('should update partner commission points', async () => {
      // Get partner UUID from QR code endpoint
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'patient2@test.com',
          password: 'Test@123456',
          full_name: 'Patient Two',
          phone_number: '5555555555',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(201);
      
      // Check partner commission points
      const [partnerRecord] = await executeQuery(
        'SELECT commission_points FROM Partners WHERE user_id = ?',
        [partner.user.id]
      );
      
      expect(parseFloat(partnerRecord[0].commission_points)).toBe(10.00);
    });
    
    test('should fail with invalid referral code', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'patient3@test.com',
          password: 'Test@123456',
          full_name: 'Patient Three',
          phone_number: '6666666666',
          role: 'patient',
          referredBy: '99999999-9999-9999-9999-999999999999' // Invalid UUID format
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('referral');
    });
    
    test('should fail with inactive partner referral code', async () => {
      const inactivePartner = await createTestPartner({
        email: 'inactive2@test.com'
      }, {
        status: 'inactive'
      });
      
      // Try to use inactive partner's UUID (should fail even if we get it)
      const inactiveUuid = inactivePartner.user.uuid;
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'patient4@test.com',
          password: 'Test@123456',
          full_name: 'Patient Four',
          phone_number: '7777777777',
          role: 'patient',
          referredBy: inactiveUuid
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inactive');
    });
    
  });
  
  describe('Commission Calculation', () => {
    
    test('should calculate 10 points per referral', async () => {
      // Get partner UUID for referrals
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      // Create 3 referrals
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `patient${i}@test.com`,
            password: 'Test@123456',
            full_name: `Patient ${i}`,
            phone_number: `${1000000000 + i}`,
            role: 'patient',
            referredBy: partnerUuid // Use UUID
          })
          .expect(201);
      }
      
      // Check total commission
      const [partnerRecord] = await executeQuery(
        'SELECT commission_points FROM Partners WHERE user_id = ?',
        [partner.user.id]
      );
      
      expect(parseFloat(partnerRecord[0].commission_points)).toBe(30.00);
    });
    
    test('should maintain commission accuracy for concurrent referrals', async () => {
      // Get partner UUID for referrals
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      // Simulate concurrent registrations
      const registrations = [];
      for (let i = 0; i < 5; i++) {
        registrations.push(
          request(app)
            .post('/api/auth/register')
            .send({
              email: `concurrent${i}@test.com`,
              password: 'Test@123456',
              full_name: `Concurrent ${i}`,
              phone_number: `${2000000000 + i}`,
              role: 'patient',
              referredBy: partnerUuid // Use UUID
            })
        );
      }
      
      await Promise.all(registrations);
      
      // Verify commission is exactly 50 (5 referrals * 10 points)
      const [partnerRecord] = await executeQuery(
        'SELECT commission_points FROM Partners WHERE user_id = ?',
        [partner.user.id]
      );
      
      expect(parseFloat(partnerRecord[0].commission_points)).toBe(50.00);
    });
    
  });
  
  describe('Edge Cases', () => {
    
    test('should prevent duplicate referrals for same patient', async () => {
      // Get partner UUID for referrals
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Test@123456',
          full_name: 'Duplicate Test',
          phone_number: '8888888888',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(201);
      
      // Attempt to register again (should fail due to duplicate email)
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Test@123456',
          full_name: 'Duplicate Test',
          phone_number: '8888888888',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(400);
      
      // Verify only one referral was created
      const [referrals] = await executeQuery(
        'SELECT COUNT(*) as count FROM Referrals WHERE partner_user_id = ?',
        [partner.user.id]
      );
      
      expect(referrals[0].count).toBe(1);
    });
    
    test('should handle registration without referral code', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noreferral@test.com',
          password: 'Test@123456',
          full_name: 'No Referral',
          phone_number: '9999999999',
          role: 'patient'
          // No referredBy field
        })
        .expect(201);
      
      const patientUserId = response.body.data.user.id;
      
      // Verify no referral was created
      const [referrals] = await executeQuery(
        'SELECT COUNT(*) as count FROM Referrals WHERE patient_user_id = ?',
        [patientUserId]
      );
      
      expect(referrals[0].count).toBe(0);
    });
    
  });
  
  describe('Audit Logging', () => {
    
    test('should log referral creation in audit logs', async () => {
      // Get partner UUID
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'audit@test.com',
          password: 'Test@123456',
          full_name: 'Audit Test',
          phone_number: '1111111111',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(201);
      
      const patientUserId = response.body.data.user.id;
      
      // Check audit logs
      const [auditLogs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE user_id = ? AND action = ? AND target_entity = ?',
        [patientUserId, 'create', 'Referrals']
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].details).toContain(partner.user.id.toString());
    });
    
    test('should log commission update in audit logs', async () => {
      // Get partner UUID
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'commission_audit@test.com',
          password: 'Test@123456',
          full_name: 'Commission Audit',
          phone_number: '2222222222',
          role: 'patient',
          referredBy: partnerUuid // Use UUID
        })
        .expect(201);
      
      // Check partner's audit logs for commission update (referral creation from partner's perspective)
      const [auditLogs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE user_id = ? AND action = ? AND target_entity = ?',
        [partner.user.id, 'create', 'Referrals']
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].details).toContain('10');
    });
    
  });
  
  describe('Partner Referral Dashboard', () => {
    
    test('should show referral statistics', async () => {
      // Get partner UUID
      const qrResponse = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      const partnerUuid = qrResponse.body.data.partnerUuid;
      
      // Create some referrals
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `stats${i}@test.com`,
            password: 'Test@123456',
            full_name: `Stats ${i}`,
            phone_number: `${3000000000 + i}`,
            role: 'patient',
            referredBy: partnerUuid // Use UUID
          });
      }
      
      const response = await request(app)
        .get('/api/partners/me/referrals')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('referrals');
      expect(response.body.data).toHaveProperty('totalReferrals');
      expect(response.body.data).toHaveProperty('totalCommission');
      expect(response.body.data.totalReferrals).toBe(3);
      expect(response.body.data.totalCommission).toBe(30.00);
    });
    
  });
  
});


