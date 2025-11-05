const { executeQuery } = require('../config/database');

/**
 * Generate unique invoice number in format WC-YYYY-NNNN
 * Uses atomic sequence table with FOR UPDATE lock for concurrency safety
 * 
 * @param {Object} connection - Database connection for transactions (REQUIRED)
 * @returns {Promise<string>} Generated invoice number
 */
async function generateInvoiceNumber(connection) {
  if (!connection) {
    throw new Error('Database connection is required for generateInvoiceNumber');
  }

  const currentYear = new Date().getFullYear();
  const prefix = `WC-${currentYear}-`;
  
  try {
    // Lock the row for this year (creates row if doesn't exist)
    // FOR UPDATE ensures only one transaction can modify at a time
    const selectQuery = `
      SELECT last_sequence 
      FROM Invoice_Sequences 
      WHERE year = ? 
      FOR UPDATE
    `;
    
    let [rows] = await executeQuery(selectQuery, [currentYear], connection);
    
    let nextSequence;
    
    if (rows.length === 0) {
      // First invoice of this year - insert new row
      const insertQuery = `
        INSERT INTO Invoice_Sequences (year, last_sequence) 
        VALUES (?, 1)
      `;
      await executeQuery(insertQuery, [currentYear], connection);
      nextSequence = 1;
    } else {
      // Increment sequence atomically
      nextSequence = rows[0].last_sequence + 1;
      
      const updateQuery = `
        UPDATE Invoice_Sequences 
        SET last_sequence = ? 
        WHERE year = ?
      `;
      await executeQuery(updateQuery, [nextSequence, currentYear], connection);
    }
    
    // Pad with zeros to 4 digits
    const paddedSequence = String(nextSequence).padStart(4, '0');
    const invoiceNumber = `${prefix}${paddedSequence}`;
    
    // Validate format before returning
    if (!validateInvoiceNumber(invoiceNumber)) {
      throw new Error('Generated invoice number is invalid');
    }
    
    return invoiceNumber;
    
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new Error(`Failed to generate invoice number: ${error.message}`);
  }
}

/**
 * Parse invoice number to extract year and sequence
 */
function parseInvoiceNumber(invoiceNumber) {
  if (!validateInvoiceNumber(invoiceNumber)) {
    throw new Error('Invalid invoice number format');
  }
  
  const parts = invoiceNumber.split('-');
  
  return {
    prefix: parts[0],
    year: parseInt(parts[1]),
    sequence: parseInt(parts[2])
  };
}

/**
 * Validate invoice number format (WC-YYYY-NNNN)
 */
function validateInvoiceNumber(invoiceNumber) {
  const regex = /^WC-\d{4}-\d{4}$/;
  return regex.test(invoiceNumber);
}

module.exports = {
  generateInvoiceNumber,
  parseInvoiceNumber,
  validateInvoiceNumber
};
