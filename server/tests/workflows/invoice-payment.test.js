const request = require('supertest');
const app = require('../../src/app');
const { createTestPatient, createTestUser, truncateTable, executeQuery } = require('../setup');

describe('Invoice-Payment Workflow End-to-End Tests', () => {
  
  let patientData;
  let patientToken;
  let staffToken;
  let adminToken;
  let serviceId;
  
  beforeEach(async () => {
    await truncateTable('Users');
    await truncateTable('Patients');
    await truncateTable('Staff_Members');
    await truncateTable('Services');
    await truncateTable('Invoices');
    await truncateTable('Invoice_Items');
    await truncateTable('Payments');
    
    // Create test users
    patientData = await createTestPatient({
      email: 'patient@test.com',
      full_name: 'Test Patient'
    });
    patientToken = patientData.user.accessToken;
    
    const staff = await createTestUser('staff', { email: 'staff@test.com' });
    staffToken = staff.accessToken;
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    // Create a test service
    const [serviceResult] = await executeQuery(
      'INSERT INTO Services (name, category, price, description) VALUES (?, ?, ?, ?)',
      ['OPD Consultation', 'consultation', 50.00, 'General consultation']
    );
    serviceId = serviceResult.insertId;
  });
  
  describe('Complete Invoice-Payment Workflow', () => {
    
    test('should complete full billing workflow', async () => {
      // Step 1: Staff creates invoice for patient
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [
          {
            service_id: serviceId,
            description: 'OPD Consultation',
            quantity: 1,
            unit_price: 50.00
          },
          {
            description: 'Medicine',
            quantity: 2,
            unit_price: 15.00
          }
        ]
      };
      
      const createResponse = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      expect(createResponse.body.data).toHaveProperty('invoice');
      expect(createResponse.body.data.invoice.total_amount).toBe(80.00); // 50 + (2*15)
      expect(createResponse.body.data.invoice.status).toBe('pending');
      
      const invoiceId = createResponse.body.data.invoice.id;
      const invoiceNumber = createResponse.body.data.invoice.invoice_number;
      
      // Step 2: Verify invoice items created
      const [items] = await executeQuery(
        'SELECT * FROM Invoice_Items WHERE invoice_id = ?',
        [invoiceId]
      );
      
      expect(items.length).toBe(2);
      
      // Step 3: Patient views invoice
      const patientViewResponse = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(patientViewResponse.body.data.invoice.invoice_number).toBe(invoiceNumber);
      expect(patientViewResponse.body.data.invoice.total_amount).toBe(80.00);
      
      // Step 4: Staff records payment
      const paymentData = {
        invoice_id: invoiceId,
        amount: 80.00,
        payment_method: 'cash',
        transaction_id: 'TXN123456'
      };
      
      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(201);
      
      expect(paymentResponse.body).toHaveProperty('data');
      expect(paymentResponse.body.data).toHaveProperty('payment');
      expect(paymentResponse.body.data.payment.amount).toBe(80.00);
      
      // Step 5: Verify invoice status changed to 'paid'
      const [updatedInvoice] = await executeQuery(
        'SELECT status FROM Invoices WHERE id = ?',
        [invoiceId]
      );
      
      expect(updatedInvoice[0].status).toBe('paid');
      
      // Step 6: Verify audit logs
      const [auditLogs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE (action = ? AND target_entity = ?) OR (action = ? AND target_entity = ?)',
        ['create', 'Invoices', 'create', 'Payments']
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
    
  });
  
  describe('Invoice Creation', () => {
    
    test('should create invoice with items successfully', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [
          {
            service_id: serviceId,
            description: 'Consultation',
            quantity: 1,
            unit_price: 50.00
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      expect(response.body.data.invoice.total_amount).toBe(50.00);
      expect(response.body.data.invoice.status).toBe('pending');
    });
    
    test('should generate unique invoice number', async () => {
      const year = new Date().getFullYear();
      
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 100.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      expect(response.body.data.invoice.invoice_number).toMatch(new RegExp(`WC-${year}-\\d{4}`));
    });
    
    test('should calculate total amount correctly', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [
          { description: 'Item 1', quantity: 2, unit_price: 25.00 },
          { description: 'Item 2', quantity: 3, unit_price: 10.00 },
          { description: 'Item 3', quantity: 1, unit_price: 15.50 }
        ]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      // (2*25) + (3*10) + (1*15.50) = 50 + 30 + 15.50 = 95.50
      expect(response.body.data.invoice.total_amount).toBe(95.50);
    });
    
    test('should require staff or admin role', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(invoiceData)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should validate invoice items', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [] // Empty items
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('items');
    });
    
    test('should set due date for IPD invoices', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'ipd',
        payment_method: 'insurance_credit', // Use canonical enum value (insurance → insurance_credit)
        items: [{ description: 'IPD Service', quantity: 1, unit_price: 200.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      expect(response.body.data.invoice.due_date).toBeDefined();
    });
    
  });
  
  describe('Invoice Retrieval', () => {
    
    let invoiceId;
    
    beforeEach(async () => {
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 50.00, description: 'Test Service' }
      ]);
      invoiceId = invoice.id;
    });
    
    test('should get specific invoice', async () => {
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data.invoice.id).toBe(invoiceId);
    });
    
    test('should list patient own invoices', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('invoices');
      expect(Array.isArray(response.body.data.invoices)).toBe(true);
    });
    
    test('should include invoice items in response', async () => {
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data.invoice).toHaveProperty('items');
      expect(Array.isArray(response.body.data.invoice.items)).toBe(true);
    });
    
    test('should filter invoices by status', async () => {
      const response = await request(app)
        .get('/api/invoices/me?status=pending')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      if (response.body.data.invoices.length > 0) {
        expect(response.body.data.invoices.every(inv => inv.status === 'pending')).toBe(true);
      }
    });
    
    test('should prevent patient from viewing other patient invoices', async () => {
      const otherPatient = await createTestPatient({ email: 'other@test.com' });
      
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${otherPatient.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should allow staff to view all invoices', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('invoices');
    });
    
  });
  
  describe('Payment Recording', () => {
    
    let invoiceId;
    let totalAmount;
    
    beforeEach(async () => {
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 100.00, description: 'Service' }
      ]);
      invoiceId = invoice.id;
      totalAmount = invoice.total_amount;
    });
    
    test('should record full payment successfully', async () => {
      const paymentData = {
        invoice_id: invoiceId,
        amount: totalAmount,
        payment_method: 'cash',
        transaction_id: 'CASH123'
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(201);
      
      expect(response.body.data.payment.amount).toBe(totalAmount);
      
      // Verify invoice status updated to 'paid'
      const [invoice] = await executeQuery(
        'SELECT status FROM Invoices WHERE id = ?',
        [invoiceId]
      );
      expect(invoice[0].status).toBe('paid');
    });
    
    test('should handle partial payments', async () => {
      const partialAmount = totalAmount / 2;
      
      const paymentData = {
        invoice_id: invoiceId,
        amount: partialAmount,
        payment_method: 'cash',
        transaction_id: 'PARTIAL123'
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(201);
      
      expect(response.body.data.payment.amount).toBe(partialAmount);
      
      // Verify invoice status is 'partially_paid'
      const [invoice] = await executeQuery(
        'SELECT status FROM Invoices WHERE id = ?',
        [invoiceId]
      );
      expect(invoice[0].status).toBe('partially_paid');
    });
    
    test('should reject payment exceeding invoice amount', async () => {
      const excessAmount = totalAmount + 50.00;
      
      const paymentData = {
        invoice_id: invoiceId,
        amount: excessAmount,
        payment_method: 'cash',
        transaction_id: 'EXCESS123'
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('exceeds');
    });
    
    test('should validate payment method', async () => {
      const paymentData = {
        invoice_id: invoiceId,
        amount: totalAmount,
        payment_method: 'invalid_method',
        transaction_id: 'TXN123'
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('payment method');
    });
    
    test('should require transaction ID', async () => {
      const paymentData = {
        invoice_id: invoiceId,
        amount: totalAmount,
        payment_method: 'card'
        // Missing transaction_id
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should record multiple partial payments', async () => {
      const payment1Amount = totalAmount * 0.3;
      const payment2Amount = totalAmount * 0.7;
      
      // First payment
      await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoice_id: invoiceId,
          amount: payment1Amount,
          payment_method: 'cash',
          transaction_id: 'PART1'
        })
        .expect(201);
      
      // Second payment (completes payment)
      await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoice_id: invoiceId,
          amount: payment2Amount,
          payment_method: 'cash',
          transaction_id: 'PART2'
        })
        .expect(201);
      
      // Verify invoice is now paid
      const [invoice] = await executeQuery(
        'SELECT status FROM Invoices WHERE id = ?',
        [invoiceId]
      );
      expect(invoice[0].status).toBe('paid');
    });
    
  });
  
  describe('Invoice Status Management', () => {
    
    let invoiceId;
    
    beforeEach(async () => {
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 50.00, description: 'Service' }
      ]);
      invoiceId = invoice.id;
    });
    
    test('should update invoice status', async () => {
      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'cancelled' })
        .expect(200);
      
      expect(response.body.data.invoice.status).toBe('cancelled');
    });
    
    test('should validate status transitions', async () => {
      // First, mark as paid
      await executeQuery(
        'UPDATE Invoices SET status = ? WHERE id = ?',
        ['paid', invoiceId]
      );
      
      // Try to change paid invoice to pending (should fail)
      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'pending' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should mark overdue invoices', async () => {
      // Set due date in past
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      await executeQuery(
        'UPDATE Invoices SET due_date = ?, invoice_type = ? WHERE id = ?',
        [pastDate, 'ipd', invoiceId]
      );
      
      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'overdue' })
        .expect(200);
      
      expect(response.body.data.invoice.status).toBe('overdue');
    });
    
  });
  
  describe('Payment History', () => {
    
    let invoiceId;
    
    beforeEach(async () => {
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 100.00, description: 'Service' }
      ]);
      invoiceId = invoice.id;
      
      // Record a payment
      await executeQuery(
        'INSERT INTO Payments (invoice_id, amount, payment_method, transaction_id) VALUES (?, ?, ?, ?)',
        [invoiceId, 100.00, 'cash', 'TXN123']
      );
    });
    
    test('should get payment history for invoice', async () => {
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('payments');
      expect(Array.isArray(response.body.data.payments)).toBe(true);
      expect(response.body.data.payments.length).toBeGreaterThan(0);
    });
    
    test('should show total paid amount', async () => {
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data.invoice).toHaveProperty('total_paid');
      expect(response.body.data.invoice.total_paid).toBe(100.00);
    });
    
    test('should show remaining balance', async () => {
      // Create invoice with partial payment
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 200.00, description: 'Service' }
      ]);
      
      await executeQuery(
        'INSERT INTO Payments (invoice_id, amount, payment_method, transaction_id) VALUES (?, ?, ?, ?)',
        [invoice.id, 100.00, 'cash', 'PARTIAL123']
      );
      
      const response = await request(app)
        .get(`/api/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data.invoice).toHaveProperty('balance');
      expect(response.body.data.invoice.balance).toBe(100.00);
    });
    
  });
  
  describe('Audit Logging', () => {
    
    test('should log invoice creation', async () => {
      const invoiceData = {
        patient_user_id: patientData.user.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      const [logs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE action = ? AND target_entity = ?',
        ['create', 'Invoices']
      );
      
      expect(logs.length).toBeGreaterThan(0);
    });
    
    test('should log payment recording', async () => {
      const { createTestInvoice } = require('../setup');
      const invoice = await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 100.00, description: 'Service' }
      ]);
      
      await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoice_id: invoice.id,
          amount: 100.00,
          payment_method: 'cash',
          transaction_id: 'TXN789'
        })
        .expect(201);
      
      const [logs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE action = ? AND target_entity = ?',
        ['create', 'Payments']
      );
      
      expect(logs.length).toBeGreaterThan(0);
    });
    
  });

  describe('Concurrency Tests', () => {
    
    test('should generate unique invoice numbers under concurrent load', async () => {
      // Truncate invoice sequences to start fresh
      await executeQuery('TRUNCATE TABLE Invoice_Sequences');
      
      // Create 20 concurrent invoice requests
      const concurrentRequests = 20;
      const invoicePromises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/invoices')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            patient_user_id: patientData.user.id,
            invoice_type: 'opd',
            payment_method: 'cash',
            items: [
              {
                service_id: serviceId,
                quantity: 1,
                unit_price: 50.00,
                description: `Concurrent test ${i}`
              }
            ]
          });
        
        invoicePromises.push(promise);
      }
      
      // Execute all requests in parallel
      const responses = await Promise.all(invoicePromises);
      
      // Verify all succeeded
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('invoice');
        expect(response.body.data.invoice).toHaveProperty('invoice_number');
      });
      
      // Extract all invoice numbers
      const invoiceNumbers = responses.map(r => r.body.data.invoice.invoice_number);
      
      // Verify all are unique
      const uniqueNumbers = new Set(invoiceNumbers);
      expect(uniqueNumbers.size).toBe(concurrentRequests);
      
      // Verify all follow WC-YYYY-NNNN format
      const currentYear = new Date().getFullYear();
      const pattern = new RegExp(`^WC-${currentYear}-\\d{4}$`);
      invoiceNumbers.forEach(num => {
        expect(num).toMatch(pattern);
      });
      
      // Verify sequences are consecutive (no gaps)
      const sequences = invoiceNumbers
        .map(num => parseInt(num.split('-')[2]))
        .sort((a, b) => a - b);
      
      for (let i = 0; i < sequences.length; i++) {
        expect(sequences[i]).toBe(i + 1);
      }
      
      // Verify sequence table reflects correct count
      const [rows] = await executeQuery(
        'SELECT last_sequence FROM Invoice_Sequences WHERE year = ?',
        [currentYear]
      );
      expect(rows[0].last_sequence).toBe(concurrentRequests);
    });
    
  });
  
});

