const { executeQuery } = require('../config/database');

class InvoiceItem {
  /**
   * Find invoice items by invoice ID
   */
  static async findByInvoiceId(invoiceId, connection = null) {
    const query = `
      SELECT 
        ii.*,
        s.name as service_name,
        s.service_category
      FROM Invoice_Items ii
      LEFT JOIN Services s ON ii.service_id = s.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id
    `;
    
    const [rows] = await executeQuery(query, [invoiceId], connection);
    return rows.map(row => this._transformInvoiceItem(row));
  }

  /**
   * Create invoice item
   */
  static async create(itemData, connection = null) {
    const {
      invoice_id,
      service_id = null,
      item_description,
      quantity = 1,
      unit_price,
      total_price
    } = itemData;

    // Validate total_price calculation
    const calculatedTotal = parseFloat(quantity) * parseFloat(unit_price);
    const providedTotal = parseFloat(total_price);
    
    if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
      throw new Error('Total price does not match quantity * unit_price');
    }

    const query = `
      INSERT INTO Invoice_Items 
      (invoice_id, service_id, item_description, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      invoice_id,
      service_id,
      item_description,
      quantity,
      unit_price,
      total_price
    ];

    const [result] = await executeQuery(query, params, connection);
    
    // Fetch and return the created item
    const fetchQuery = `
      SELECT 
        ii.*,
        s.name as service_name,
        s.service_category
      FROM Invoice_Items ii
      LEFT JOIN Services s ON ii.service_id = s.id
      WHERE ii.id = ?
    `;
    const [rows] = await executeQuery(fetchQuery, [result.insertId], connection);
    return rows.length > 0 ? this._transformInvoiceItem(rows[0]) : null;
  }

  /**
   * Create multiple invoice items in batch
   */
  static async createBatch(invoiceId, itemsArray, connection = null) {
    if (!itemsArray || itemsArray.length === 0) {
      throw new Error('Items array cannot be empty');
    }

    // Validate all items before insertion
    for (const itemData of itemsArray) {
      const calculatedTotal = parseFloat(itemData.quantity || 1) * parseFloat(itemData.unit_price);
      const providedTotal = parseFloat(itemData.total_price);
      
      if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
        throw new Error(`Total price does not match quantity * unit_price for item: ${itemData.item_description}`);
      }
    }

    // Build bulk INSERT query
    const values = [];
    const params = [];
    
    for (const itemData of itemsArray) {
      values.push('(?, ?, ?, ?, ?, ?)');
      params.push(
        invoiceId,
        itemData.service_id || null,
        itemData.item_description,
        itemData.quantity || 1,
        itemData.unit_price,
        itemData.total_price
      );
    }

    const query = `
      INSERT INTO Invoice_Items 
      (invoice_id, service_id, item_description, quantity, unit_price, total_price)
      VALUES ${values.join(', ')}
    `;

    await executeQuery(query, params, connection);

    // Fetch and return created items
    return await this.findByInvoiceId(invoiceId, connection);
  }

  /**
   * Update invoice item by ID
   */
  static async updateById(id, itemData, connection = null) {
    const allowedFields = ['item_description', 'quantity', 'unit_price', 'total_price'];
    const updates = [];
    const params = [];

    // If quantity or unit_price is updated, recalculate total_price
    if (itemData.quantity !== undefined || itemData.unit_price !== undefined) {
      // Fetch current item
      const [currentRows] = await executeQuery('SELECT * FROM Invoice_Items WHERE id = ?', [id], connection);
      if (currentRows.length === 0) {
        throw new Error('Invoice item not found');
      }
      
      const current = currentRows[0];
      const newQuantity = itemData.quantity !== undefined ? itemData.quantity : current.quantity;
      const newUnitPrice = itemData.unit_price !== undefined ? itemData.unit_price : current.unit_price;
      
      // Recalculate total_price
      itemData.total_price = parseFloat(newQuantity) * parseFloat(newUnitPrice);
    }

    Object.keys(itemData).forEach(key => {
      if (allowedFields.includes(key) && itemData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(itemData[key]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `UPDATE Invoice_Items SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(query, params, connection);

    // Fetch and return updated item
    const fetchQuery = `
      SELECT 
        ii.*,
        s.name as service_name,
        s.service_category
      FROM Invoice_Items ii
      LEFT JOIN Services s ON ii.service_id = s.id
      WHERE ii.id = ?
    `;
    const [rows] = await executeQuery(fetchQuery, [id], connection);
    return rows.length > 0 ? this._transformInvoiceItem(rows[0]) : null;
  }

  /**
   * Delete invoice item by ID
   */
  static async deleteById(id, connection = null) {
    const query = 'DELETE FROM Invoice_Items WHERE id = ?';
    await executeQuery(query, [id], connection);
    return { deleted: true };
  }

  /**
   * Delete all items for an invoice
   */
  static async deleteByInvoiceId(invoiceId, connection = null) {
    const query = 'DELETE FROM Invoice_Items WHERE invoice_id = ?';
    const [result] = await executeQuery(query, [invoiceId], connection);
    return { deleted: result.affectedRows };
  }

  /**
   * Calculate total for invoice from items
   */
  static async calculateInvoiceTotal(invoiceId, connection = null) {
    const query = `
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM Invoice_Items
      WHERE invoice_id = ?
    `;
    
    const [rows] = await executeQuery(query, [invoiceId], connection);
    return parseFloat(rows[0].total);
  }

  /**
   * Transform database invoice item to camelCase
   */
  static _transformInvoiceItem(dbItem) {
    if (!dbItem) return null;

    return {
      id: dbItem.id,
      invoiceId: dbItem.invoice_id,
      serviceId: dbItem.service_id,
      itemDescription: dbItem.item_description,
      quantity: dbItem.quantity,
      unitPrice: parseFloat(dbItem.unit_price),
      totalPrice: parseFloat(dbItem.total_price),
      createdAt: dbItem.created_at,
      // Service info if joined
      serviceName: dbItem.service_name,
      serviceCategory: dbItem.service_category
    };
  }
}

module.exports = { InvoiceItem };
