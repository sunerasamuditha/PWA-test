const { executeQuery } = require('../src/config/database');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');

/**
 * Test Data Seeding Script
 * Generates realistic test data for comprehensive testing
 * Uses Faker.js for realistic data generation
 */

/**
 * Seed all test data
 */
async function seed() {
  console.log('Starting test data seeding...');
  
  try {
    // Seed in dependency order
    const users = await seedUsers();
    const patients = await seedPatients(users);
    const partners = await seedPartners(users);
    const staff = await seedStaff(users);
    const services = await seedServices();
    const appointments = await seedAppointments(patients);
    const invoices = await seedInvoices(patients, services);
    const documents = await seedDocuments(patients);
    const referrals = await seedReferrals(patients, partners);
    await seedPayments(invoices);
    await seedStaffShifts(staff);
    
    console.log('Test data seeding complete!');
    console.log(`Created:
      - ${users.length} users
      - ${patients.length} patients
      - ${partners.length} partners
      - ${staff.length} staff members
      - ${services.length} services
      - ${appointments.length} appointments
      - ${invoices.length} invoices
      - ${documents.length} documents
      - ${referrals.length} referrals
    `);
    
    return {
      users,
      patients,
      partners,
      staff,
      services,
      appointments,
      invoices,
      documents,
      referrals
    };
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

/**
 * Seed users (50 total: 5 super_admins, 10 admins, 15 staff, 10 partners, 30 patients)
 */
async function seedUsers() {
  const users = [];
  const passwordHash = await bcrypt.hash('Test@123', 10);
  
  const roles = [
    { role: 'super_admin', count: 5 },
    { role: 'admin', count: 10 },
    { role: 'staff', count: 15 },
    { role: 'partner', count: 10 },
    { role: 'patient', count: 30 }
  ];
  
  for (const { role, count } of roles) {
    for (let i = 0; i < count; i++) {
      const user = {
        email: faker.internet.email().toLowerCase(),
        password_hash: passwordHash,
        full_name: faker.person.fullName(),
        phone_number: faker.phone.number('##########'),
        role: role,
        is_active: Math.random() < 0.9 // 90% active (Faker v8 compatible)
      };
      
      const query = `
        INSERT INTO Users (email, password_hash, full_name, phone_number, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await executeQuery(query, [
        user.email,
        user.password_hash,
        user.full_name,
        user.phone_number,
        user.role,
        user.is_active
      ]);
      
      users.push({ id: result.insertId, ...user });
    }
  }
  
  return users;
}

/**
 * Seed patients (30 patient records with passport/insurance)
 */
async function seedPatients(users) {
  const patients = [];
  const patientUsers = users.filter(u => u.role === 'patient');
  
  for (const user of patientUsers) {
    // Generate passport info
    const passportInfo = {
      number: faker.string.alphanumeric({ length: 9, casing: 'upper' }),
      country: faker.location.countryCode(),
      expiryDate: faker.date.future({ years: 5 }).toISOString().split('T')[0]
    };
    
    // Generate insurance info (80% have insurance)
    const hasInsurance = Math.random() < 0.8; // Faker v8 compatible
    const insuranceInfo = hasInsurance ? {
      provider: faker.company.name() + ' Insurance',
      policyNumber: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
      coverageType: faker.helpers.arrayElement(['basic', 'comprehensive', 'premium'])
    } : null;
    
    const patient = {
      user_id: user.id,
      current_address: faker.location.streetAddress() + ', ' + faker.location.city(),
      passport_info: JSON.stringify(passportInfo),
      insurance_info: insuranceInfo ? JSON.stringify(insuranceInfo) : null
    };
    
    const query = `
      INSERT INTO Patients (user_id, current_address, passport_info, insurance_info)
      VALUES (?, ?, ?, ?)
    `;
    
    await executeQuery(query, [
      patient.user_id,
      patient.current_address,
      patient.passport_info,
      patient.insurance_info
    ]);
    
    patients.push({ user_id: user.id, ...patient });
  }
  
  return patients;
}

/**
 * Seed partners (10 partner records with various statuses)
 */
async function seedPartners(users) {
  const partners = [];
  const partnerUsers = users.filter(u => u.role === 'partner');
  
  for (const user of partnerUsers) {
    const partner = {
      user_id: user.id,
      partner_type: faker.helpers.arrayElement(['guide', 'agent', 'hospital', 'clinic']),
      status: faker.helpers.weightedArrayElement([
        { weight: 7, value: 'active' },
        { weight: 2, value: 'inactive' },
        { weight: 1, value: 'suspended' }
      ]),
      commission_points: faker.number.float({ min: 0, max: 500, precision: 2 })
    };
    
    const query = `
      INSERT INTO Partners (user_id, partner_type, status, commission_points)
      VALUES (?, ?, ?, ?)
    `;
    
    await executeQuery(query, [
      partner.user_id,
      partner.partner_type,
      partner.status,
      partner.commission_points
    ]);
    
    partners.push({ user_id: user.id, ...partner });
  }
  
  return partners;
}

/**
 * Seed staff members (15 staff records with permissions)
 */
async function seedStaff(users) {
  const staff = [];
  const staffUsers = users.filter(u => u.role === 'staff');
  
  const staffRoles = {
    front_desk: ['manage_appointments', 'manage_documents', 'view_patients'],
    nurse: ['manage_appointments', 'manage_documents', 'view_health_records'],
    pharmacist: ['manage_invoices', 'view_patients'],
    lab_technician: ['manage_documents', 'view_health_records']
  };
  
  for (const user of staffUsers) {
    const staffRole = faker.helpers.objectKey(staffRoles);
    
    const staffMember = {
      user_id: user.id,
      staff_role: staffRole,
      permissions: JSON.stringify(staffRoles[staffRole])
    };
    
    const query = `
      INSERT INTO Staff_Members (user_id, staff_role, permissions)
      VALUES (?, ?, ?)
    `;
    
    await executeQuery(query, [
      staffMember.user_id,
      staffMember.staff_role,
      staffMember.permissions
    ]);
    
    staff.push({ user_id: user.id, ...staffMember });
  }
  
  return staff;
}

/**
 * Seed services (20 medical services)
 */
async function seedServices() {
  const services = [];
  
  const serviceTypes = [
    { name: 'OPD Consultation', category: 'consultation', price: 50.00 },
    { name: 'IPD Admission', category: 'admission', price: 200.00 },
    { name: 'Emergency Visit', category: 'emergency', price: 100.00 },
    { name: 'X-Ray', category: 'imaging', price: 75.00 },
    { name: 'Blood Test - Complete Count', category: 'lab', price: 30.00 },
    { name: 'Blood Test - Lipid Panel', category: 'lab', price: 40.00 },
    { name: 'ECG', category: 'diagnostic', price: 50.00 },
    { name: 'Ultrasound', category: 'imaging', price: 100.00 },
    { name: 'CT Scan', category: 'imaging', price: 250.00 },
    { name: 'MRI Scan', category: 'imaging', price: 500.00 },
    { name: 'Minor Surgery', category: 'surgery', price: 300.00 },
    { name: 'Major Surgery', category: 'surgery', price: 1500.00 },
    { name: 'Physiotherapy Session', category: 'therapy', price: 60.00 },
    { name: 'Vaccination', category: 'preventive', price: 25.00 },
    { name: 'Health Checkup Package', category: 'preventive', price: 150.00 },
    { name: 'Dental Consultation', category: 'dental', price: 40.00 },
    { name: 'Dental Cleaning', category: 'dental', price: 80.00 },
    { name: 'Optical Consultation', category: 'optical', price: 35.00 },
    { name: 'Prescription Glasses', category: 'optical', price: 120.00 },
    { name: 'Medicine - Generic', category: 'pharmacy', price: 20.00 }
  ];
  
  for (const service of serviceTypes) {
    const query = `
      INSERT INTO Services (name, category, price, description)
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await executeQuery(query, [
      service.name,
      service.category,
      service.price,
      `${service.name} service`
    ]);
    
    services.push({ id: result.insertId, ...service });
  }
  
  return services;
}

/**
 * Seed appointments (100 appointments)
 */
async function seedAppointments(patients) {
  const appointments = [];
  
  for (let i = 0; i < 100; i++) {
    const patient = faker.helpers.arrayElement(patients);
    
    // Generate appointment datetime (50% past, 50% future)
    const isPast = Math.random() < 0.5; // Faker v8 compatible
    const appointmentDatetime = isPast
      ? faker.date.recent({ days: 90 })
      : faker.date.soon({ days: 90 });
    
    const appointment = {
      patient_user_id: patient.user_id,
      appointment_datetime: appointmentDatetime,
      type: faker.helpers.arrayElement(['opd', 'admission']), // Match DB enum: opd, admission
      status: isPast
        ? faker.helpers.arrayElement(['completed', 'cancelled']) // Match DB enum: scheduled, checked_in, completed, cancelled
        : faker.helpers.arrayElement(['scheduled', 'checked_in']),
      notes: faker.lorem.sentence()
    };
    
    const query = `
      INSERT INTO Appointments (patient_user_id, appointment_datetime, type, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const [result] = await executeQuery(query, [
      appointment.patient_user_id,
      appointment.appointment_datetime,
      appointment.type,
      appointment.status,
      appointment.notes
    ]);
    
    appointments.push({ id: result.insertId, ...appointment });
  }
  
  return appointments;
}

/**
 * Seed invoices (80 invoices with items)
 */
async function seedInvoices(patients, services) {
  const invoices = [];
  const year = new Date().getFullYear();
  
  for (let i = 0; i < 80; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const invoiceNumber = `WC-${year}-${String(i + 1).padStart(4, '0')}`;
    
    // Generate 1-5 invoice items
    const itemCount = faker.number.int({ min: 1, max: 5 });
    const items = [];
    let totalAmount = 0;
    
    for (let j = 0; j < itemCount; j++) {
      const service = faker.helpers.arrayElement(services);
      const quantity = faker.number.int({ min: 1, max: 3 });
      const unitPrice = service.price;
      const totalPrice = quantity * unitPrice;
      
      items.push({
        service_id: service.id,
        description: service.name,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      });
      
      totalAmount += totalPrice;
    }
    
    // Determine invoice type first
    const invoiceType = faker.helpers.arrayElement(['opd', 'ipd', 'emergency']);
    const dueDate = invoiceType === 'ipd' 
      ? faker.date.soon({ days: 30 }) 
      : null;
    
    const invoice = {
      invoice_number: invoiceNumber,
      patient_user_id: patient.user_id,
      total_amount: totalAmount,
      status: faker.helpers.weightedArrayElement([
        { weight: 5, value: 'paid' },
        { weight: 3, value: 'pending' },
        { weight: 1, value: 'overdue' },
        { weight: 1, value: 'cancelled' }
      ]),
      invoice_type: invoiceType,
      payment_method: faker.helpers.arrayElement(['cash', 'card', 'bank_transfer', 'insurance_credit']),
      due_date: dueDate
    };
    
    const invoiceQuery = `
      INSERT INTO Invoices (invoice_number, patient_user_id, total_amount, status, invoice_type, payment_method, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [invoiceResult] = await executeQuery(invoiceQuery, [
      invoice.invoice_number,
      invoice.patient_user_id,
      invoice.total_amount,
      invoice.status,
      invoice.invoice_type,
      invoice.payment_method,
      invoice.due_date
    ]);
    
    const invoiceId = invoiceResult.insertId;
    
    // Insert invoice items
    for (const item of items) {
      const itemQuery = `
        INSERT INTO Invoice_Items (invoice_id, service_id, description, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await executeQuery(itemQuery, [
        invoiceId,
        item.service_id,
        item.description,
        item.quantity,
        item.unit_price,
        item.total_price
      ]);
    }
    
    invoices.push({ id: invoiceId, ...invoice, items });
  }
  
  return invoices;
}

/**
 * Seed documents (150 documents)
 */
async function seedDocuments(patients) {
  const documents = [];
  
  // Match canonical DB enum from validation SQL
  const documentTypes = ['passport', 'insurance_card', 'test_result', 'diagnosis_card', 'lab_report', 'invoice', 'instruction_card', 'insurance_agreement', 'other'];
  
  for (let i = 0; i < 150; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const docType = faker.helpers.arrayElement(documentTypes);
    
    const document = {
      patient_user_id: patient.user_id,
      type: docType,
      file_path: `/uploads/${patient.user_id}/${faker.system.fileName()}`,
      original_filename: faker.system.fileName(),
      file_size: faker.number.int({ min: 10000, max: 5000000 }),
      mime_type: faker.helpers.arrayElement(['application/pdf', 'image/jpeg', 'image/png'])
    };
    
    const query = `
      INSERT INTO Documents (patient_user_id, type, file_path, original_filename, file_size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await executeQuery(query, [
      document.patient_user_id,
      document.type,
      document.file_path,
      document.original_filename,
      document.file_size,
      document.mime_type
    ]);
    
    documents.push({ id: result.insertId, ...document });
  }
  
  return documents;
}

/**
 * Seed referrals (50 referrals from partners)
 */
async function seedReferrals(patients, partners) {
  const referrals = [];
  
  const activePartners = partners.filter(p => p.status === 'active');
  
  for (let i = 0; i < 50; i++) {
    const partner = faker.helpers.arrayElement(activePartners);
    const patient = faker.helpers.arrayElement(patients);
    
    const referral = {
      partner_user_id: partner.user_id,
      patient_user_id: patient.user_id,
      commission_amount: 10.00, // Fixed commission per referral
      status: faker.helpers.weightedArrayElement([
        { weight: 7, value: 'completed' },
        { weight: 2, value: 'pending' },
        { weight: 1, value: 'cancelled' }
      ])
    };
    
    const query = `
      INSERT INTO Referrals (partner_user_id, patient_user_id, commission_amount, status)
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await executeQuery(query, [
      referral.partner_user_id,
      referral.patient_user_id,
      referral.commission_amount,
      referral.status
    ]);
    
    referrals.push({ id: result.insertId, ...referral });
  }
  
  return referrals;
}

/**
 * Seed payments (for paid invoices)
 */
async function seedPayments(invoices) {
  const payments = [];
  
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  
  for (const invoice of paidInvoices) {
    // Generate 1-2 payments per invoice (some invoices have partial payments)
    const paymentCount = Math.random() < 0.8 ? 1 : 2; // Faker v8 compatible
    let remainingAmount = invoice.total_amount;
    
    for (let i = 0; i < paymentCount; i++) {
      const isLastPayment = i === paymentCount - 1;
      const paymentAmount = isLastPayment
        ? remainingAmount
        : faker.number.float({ min: remainingAmount * 0.3, max: remainingAmount * 0.7, precision: 2 });
      
      const payment = {
        invoice_id: invoice.id,
        amount: paymentAmount,
        payment_method: invoice.payment_method, // Match canonical enum: cash, card, bank_transfer, insurance_credit
        transaction_id: faker.string.alphanumeric({ length: 16, casing: 'upper' }),
        paid_at: faker.date.recent({ days: 30 }) // Match DB column name: paid_at
      };
      
      const query = `
        INSERT INTO Payments (invoice_id, amount, payment_method, transaction_id, paid_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await executeQuery(query, [
        payment.invoice_id,
        payment.amount,
        payment.payment_method,
        payment.transaction_id,
        payment.paid_at
      ]);
      
      payments.push({ id: result.insertId, ...payment });
      remainingAmount -= paymentAmount;
    }
  }
  
  return payments;
}

/**
 * Seed staff shifts (for staff members)
 */
async function seedStaffShifts(staff) {
  const shifts = [];
  
  for (const staffMember of staff) {
    // Generate 10 shifts per staff member (past 30 days)
    for (let i = 0; i < 10; i++) {
      const shiftDate = faker.date.recent({ days: 30 });
      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(faker.number.int({ min: 7, max: 14 }), 0, 0, 0);
      
      const shiftEnd = new Date(shiftStart);
      shiftEnd.setHours(shiftStart.getHours() + faker.number.int({ min: 6, max: 10 }));
      
      const shift = {
        staff_user_id: staffMember.user_id,
        shift_type: faker.helpers.arrayElement(['full_night', 'day', 'intermediate']), // Match DB enum
        login_at: shiftStart, // Match DB column name: login_at
        logout_at: shiftEnd, // Match DB column name: logout_at
        total_hours: (shiftEnd - shiftStart) / (1000 * 60 * 60) // Match DB column name: total_hours
      };
      
      const query = `
        INSERT INTO Staff_Shifts (staff_user_id, shift_type, login_at, logout_at, total_hours)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await executeQuery(query, [
        shift.staff_user_id,
        shift.shift_type,
        shift.login_at,
        shift.logout_at,
        shift.total_hours
      ]);
      
      shifts.push({ id: result.insertId, ...shift });
    }
  }
  
  return shifts;
}

module.exports = { seed };
