const PDFDocument = require('pdfkit');

/**
 * Generate invoice receipt PDF
 */
async function generateInvoiceReceipt(invoiceData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      // Collect PDF chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      addHeader(doc, 'INVOICE RECEIPT');

      // WeCare branding
      doc.fontSize(20)
         .fillColor('#2563eb')
         .text('WeCare Healthcare Services', { align: 'center' });
      
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Your Health, Our Care', { align: 'center' })
         .moveDown(2);

      // Invoice details
      doc.fontSize(12)
         .fillColor('#000000')
         .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 50, 150);
      
      doc.text(`Date: ${formatDate(invoiceData.createdAt)}`, 50, 165);
      
      if (invoiceData.dueDate) {
        doc.text(`Due Date: ${formatDate(invoiceData.dueDate)}`, 50, 180);
      }
      
      doc.text(`Status: ${invoiceData.status.toUpperCase()}`, 50, 195)
         .moveDown();

      // Patient information
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Bill To:', 50, 220);
      
      doc.fontSize(11)
         .fillColor('#000000')
         .text(`${invoiceData.patientFirstName} ${invoiceData.patientLastName}`, 50, 240);
      
      if (invoiceData.patientEmail) {
        doc.text(`Email: ${invoiceData.patientEmail}`, 50, 255);
      }
      
      if (invoiceData.patientPhone) {
        doc.text(`Phone: ${invoiceData.patientPhone}`, 50, 270);
      }
      
      doc.moveDown(2);

      // Line items table
      const tableTop = 310;
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Services / Items:', 50, tableTop);

      // Table headers
      const headerY = tableTop + 25;
      doc.fontSize(10)
         .fillColor('#6b7280');
      
      doc.text('Description', 50, headerY);
      doc.text('Qty', 300, headerY);
      doc.text('Unit Price', 350, headerY);
      doc.text('Total', 450, headerY);

      // Draw line under headers
      doc.moveTo(50, headerY + 15)
         .lineTo(550, headerY + 15)
         .stroke();

      // Table rows
      let yPosition = headerY + 25;
      doc.fontSize(10).fillColor('#000000');

      invoiceData.items.forEach(item => {
        doc.text(item.itemDescription, 50, yPosition, { width: 230 });
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(formatCurrency(item.unitPrice), 350, yPosition);
        doc.text(formatCurrency(item.totalPrice), 450, yPosition);
        
        yPosition += 20;
      });

      // Draw line before totals
      yPosition += 10;
      doc.moveTo(350, yPosition)
         .lineTo(550, yPosition)
         .stroke();

      // Totals
      yPosition += 15;
      doc.fontSize(11)
         .fillColor('#1f2937')
         .text('Total Amount:', 350, yPosition);
      doc.text(formatCurrency(invoiceData.totalAmount), 450, yPosition);

      // Payments received section
      if (invoiceData.payments && invoiceData.payments.length > 0) {
        yPosition += 30;
        doc.fontSize(14)
           .fillColor('#1f2937')
           .text('Payments Received:', 50, yPosition);

        yPosition += 25;
        // Display all payments with their status
        invoiceData.payments.forEach(payment => {
          doc.fontSize(10)
             .fillColor('#000000')
             .text(`${formatDate(payment.paidAt)} - ${getPaymentMethodDisplayName(payment.paymentMethod)} (${payment.paymentStatus})`, 50, yPosition);
          doc.text(formatCurrency(payment.amount), 450, yPosition);
          yPosition += 20;
        });

        // Calculate paid (completed only) and remaining
        const completedPayments = invoiceData.payments.filter(p => p.paymentStatus === 'completed');
        const paidAmount = completedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const remainingBalance = invoiceData.totalAmount - paidAmount;

        yPosition += 10;
        doc.moveTo(350, yPosition)
           .lineTo(550, yPosition)
           .stroke();

        yPosition += 15;
        doc.fontSize(11)
           .fillColor('#1f2937')
           .text('Amount Paid:', 350, yPosition);
        doc.fillColor('#10b981')
           .text(formatCurrency(paidAmount), 450, yPosition);

        yPosition += 20;
        doc.fillColor('#1f2937')
           .text('Remaining Balance:', 350, yPosition);
        doc.fillColor(remainingBalance > 0 ? '#ef4444' : '#10b981')
           .text(formatCurrency(remainingBalance), 450, yPosition);
      }

      // Footer
      addFooter(doc, 1);

      // Finalize PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate payment report PDF
 */
async function generatePaymentReport(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      addHeader(doc, 'PAYMENT REPORT');

      // WeCare branding
      doc.fontSize(20)
         .fillColor('#2563eb')
         .text('WeCare Healthcare Services', { align: 'center' });
      
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Payment History Report', { align: 'center' })
         .moveDown(2);

      // Patient information
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Patient Information:', 50, 150);
      
      doc.fontSize(11)
         .fillColor('#000000')
         .text(`Name: ${reportData.patient.firstName} ${reportData.patient.lastName}`, 50, 170);
      
      if (reportData.patient.email) {
        doc.text(`Email: ${reportData.patient.email}`, 50, 185);
      }

      // Date range
      doc.fontSize(11)
         .fillColor('#1f2937')
         .text(`Report Period: ${formatDate(reportData.startDate)} to ${formatDate(reportData.endDate)}`, 50, 210)
         .moveDown(2);

      // Summary section
      const summaryY = 240;
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Summary:', 50, summaryY);

      doc.fontSize(11)
         .fillColor('#000000')
         .text(`Total Invoices: ${reportData.summary.totalInvoices}`, 50, summaryY + 25);
      doc.text(`Total Amount Billed: ${formatCurrency(reportData.summary.totalBilled)}`, 50, summaryY + 45);
      doc.text(`Total Amount Paid: ${formatCurrency(reportData.summary.totalPaid)}`, 50, summaryY + 65);
      
      const outstanding = reportData.summary.totalBilled - reportData.summary.totalPaid;
      doc.fillColor(outstanding > 0 ? '#ef4444' : '#10b981')
         .text(`Total Outstanding: ${formatCurrency(outstanding)}`, 50, summaryY + 85);

      // Invoices and payments table
      let tableY = summaryY + 120;
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Invoice Details:', 50, tableY);

      reportData.invoices.forEach((invoice, index) => {
        tableY += 35;
        
        // Check if we need a new page
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
        }

        doc.fontSize(11)
           .fillColor('#1f2937')
           .text(`Invoice #${invoice.invoiceNumber}`, 50, tableY);
        
        doc.fontSize(10)
           .fillColor('#000000')
           .text(`Date: ${formatDate(invoice.createdAt)}`, 50, tableY + 15);
        doc.text(`Type: ${invoice.invoiceType.toUpperCase()}`, 200, tableY + 15);
        doc.text(`Total: ${formatCurrency(invoice.totalAmount)}`, 350, tableY + 15);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 450, tableY + 15);

        // Payments for this invoice
        if (invoice.payments && invoice.payments.length > 0) {
          tableY += 35;
          doc.fontSize(9)
             .fillColor('#6b7280')
             .text('Payments:', 70, tableY);

          invoice.payments.forEach(payment => {
            tableY += 15;
            doc.text(`${formatDate(payment.paidAt)} - ${getPaymentMethodDisplayName(payment.paymentMethod)}: ${formatCurrency(payment.amount)}`, 70, tableY);
          });
        }

        tableY += 10;
        doc.moveTo(50, tableY)
           .lineTo(550, tableY)
           .strokeColor('#e5e7eb')
           .stroke();
      });

      // Footer
      addFooter(doc, 1);

      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  const formatted = parseFloat(amount).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `Rp ${formatted}`;
}

/**
 * Format date
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Add header to PDF
 */
function addHeader(doc, title) {
  doc.fontSize(8)
     .fillColor('#9ca3af')
     .text(`Generated on: ${formatDate(new Date())}`, 50, 30, { align: 'right' });
}

/**
 * Add footer to PDF
 */
function addFooter(doc, pageNumber) {
  const footerY = doc.page.height - 50;
  
  doc.fontSize(8)
     .fillColor('#9ca3af')
  doc.text('Thank you for choosing WeCare Healthcare Services', 50, footerY, { align: 'center' });
  
  doc.text('For queries, contact: support@wecare.com | Phone: +62-XXX-XXX-XXXX', 50, footerY + 12, { align: 'center' });
  
  doc.text(`Page ${pageNumber}`, 50, footerY + 24, { align: 'center' });
}

/**
 * Get payment method display name
 */
function getPaymentMethodDisplayName(method) {
  const methodMap = {
    'cash': 'Cash',
    'card': 'Card',
    'bank_transfer': 'Bank Transfer',
    'insurance': 'Insurance',
    'insurance_credit': 'Insurance Credit'
  };
  return methodMap[method] || method;
}

/**
 * Format time as HH:MM AM/PM
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Format shift type to human-readable name with time range
 */
function formatShiftType(shiftType) {
  const shiftTypeMap = {
    'full_night': 'Full Night (8pm-1pm)',
    'day': 'Day (1pm-9pm)',
    'intermediate': 'Intermediate (11am-8pm)'
  };
  return shiftTypeMap[shiftType] || shiftType;
}

/**
 * Generate monthly shift report PDF
 */
async function generateMonthlyShiftReport(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      // Collect PDF chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      addHeader(doc, 'MONTHLY SHIFT REPORT');

      // WeCare branding
      doc.fontSize(20)
         .fillColor('#2563eb')
         .text('WeCare Healthcare Services', { align: 'center' });
      
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Staff Shift Tracking Report', { align: 'center' })
         .moveDown(2);

      // Report title
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[reportData.month - 1];
      
      doc.fontSize(16)
         .fillColor('#1f2937')
         .text(`${monthName} ${reportData.year} - Shift Report`, { align: 'center' })
         .moveDown(1.5);

      // Staff information section
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Staff Information:', 50, doc.y);
      
      doc.fontSize(11)
         .fillColor('#000000')
         .text(`Name: ${reportData.staff.fullName}`, 50, doc.y + 15);
      
      doc.text(`Email: ${reportData.staff.email}`, 50, doc.y + 5);
      
      doc.text(`Role: ${reportData.staff.staffRole}`, 50, doc.y + 5)
         .moveDown(2);

      // Shifts table header
      const tableTop = doc.y;
      doc.fontSize(12)
         .fillColor('#1f2937')
         .text('Shift Details:', 50, tableTop)
         .moveDown(0.5);

      // Table headers
      const headerY = doc.y;
      const colWidths = {
        date: 100,
        shiftType: 130,
        loginTime: 80,
        logoutTime: 80,
        totalHours: 70,
        notes: 100
      };
      
      doc.fontSize(10)
         .fillColor('#ffffff')
         .rect(50, headerY, 500, 20)
         .fill('#2563eb');
      
      doc.fillColor('#ffffff')
         .text('Date', 55, headerY + 5, { width: colWidths.date })
         .text('Shift Type', 155, headerY + 5, { width: colWidths.shiftType })
         .text('Login', 285, headerY + 5, { width: colWidths.loginTime })
         .text('Logout', 365, headerY + 5, { width: colWidths.logoutTime })
         .text('Hours', 445, headerY + 5, { width: colWidths.totalHours });

      // Table rows
      let currentY = headerY + 25;
      doc.fillColor('#000000');
      
      reportData.shifts.forEach((shift, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
        
        const rowColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
        doc.rect(50, currentY, 500, 20).fill(rowColor);
        
        doc.fillColor('#000000')
           .fontSize(9)
           .text(formatDate(shift.loginAt), 55, currentY + 5, { width: colWidths.date })
           .text(formatShiftType(shift.shiftType), 155, currentY + 5, { width: colWidths.shiftType })
           .text(formatTime(shift.loginAt), 285, currentY + 5, { width: colWidths.loginTime })
           .text(shift.logoutAt ? formatTime(shift.logoutAt) : 'In Progress', 365, currentY + 5, { width: colWidths.logoutTime })
           .text(shift.totalHours ? `${shift.totalHours.toFixed(2)} hrs` : 'N/A', 445, currentY + 5, { width: colWidths.totalHours });
        
        currentY += 20;
      });

      // Summary section
      doc.moveDown(2);
      const summaryY = currentY + 20;
      
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Summary:', 50, summaryY)
         .moveDown(0.5);
      
      doc.fontSize(11)
         .fillColor('#000000')
         .text(`Total Shifts: ${reportData.summary.totalShifts}`, 50, doc.y);
      
      doc.text(`Total Hours: ${reportData.summary.totalHours.toFixed(2)} hours`, 50, doc.y + 5)
         .moveDown(1);
      
      // Hours breakdown by shift type
      doc.fontSize(12)
         .fillColor('#1f2937')
         .text('Hours by Shift Type:', 50, doc.y)
         .moveDown(0.3);
      
      doc.fontSize(10)
         .fillColor('#000000');
      
      if (reportData.summary.hoursByShiftType.full_night > 0) {
        doc.text(`  • Full Night: ${reportData.summary.hoursByShiftType.full_night.toFixed(2)} hours`, 50, doc.y + 5);
      }
      
      if (reportData.summary.hoursByShiftType.day > 0) {
        doc.text(`  • Day Shift: ${reportData.summary.hoursByShiftType.day.toFixed(2)} hours`, 50, doc.y + 5);
      }
      
      if (reportData.summary.hoursByShiftType.intermediate > 0) {
        doc.text(`  • Intermediate: ${reportData.summary.hoursByShiftType.intermediate.toFixed(2)} hours`, 50, doc.y + 5);
      }

      // Add footer
      addFooter(doc);

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoiceReceipt,
  generatePaymentReport,
  generateMonthlyShiftReport,
  formatCurrency,
  formatDate,
  formatTime,
  formatShiftType,
  addHeader,
  addFooter
};
