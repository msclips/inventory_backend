const express = require('express');
const router = express.Router();
const db = require('../db');
const { refreshMaterialLedger } = require('../services/ledgerService');

function validatePayload(body) {
  const errors = [];

  if (!body.material_id || Number(body.material_id) <= 0) {
    errors.push('material_id is required');
  }

  if (body.quantity === undefined || body.quantity === null || Number(body.quantity) <= 0) {
    errors.push('quantity must be greater than 0');
  }

  if (body.rate === undefined || body.rate === null || Number(body.rate) < 0) {
    errors.push('rate must be 0 or greater');
  }

  if (!body.supplier_name || !String(body.supplier_name).trim()) {
    errors.push('supplier_name is required');
  }

  if (!body.date) {
    errors.push('date is required');
  }

  return errors;
}

// LIST with search & pagination
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const params = [];
    let whereClause = '';

    if (search.trim()) {
      whereClause = `WHERE mm.material_name LIKE ? OR mm.material_code LIKE ? OR mr.receipt_no LIKE ? OR mr.supplier_name LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const [[{ total }]] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM material_receipt mr
       INNER JOIN material_master mm ON mm.id = mr.material_id
       ${whereClause}`,
      params
    );

    const [rows] = await db.promise().query(
      `SELECT mr.id, mr.material_id, mm.material_name, mm.material_code, mm.unit,
              mr.receipt_no, mr.quantity, mr.rate, mr.total_amount, mr.supplier_name, mr.date
       FROM material_receipt mr
       INNER JOIN material_master mm ON mm.id = mr.material_id
       ${whereClause}
       ORDER BY mr.date DESC, mr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material receipt records', error: error.message });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT mr.id, mr.material_id, mm.material_name, mm.material_code, mm.unit,
              mr.receipt_no, mr.quantity, mr.rate, mr.total_amount, mr.supplier_name, mr.date
       FROM material_receipt mr
       INNER JOIN material_master mm ON mm.id = mr.material_id
       WHERE mr.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Material receipt record not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Fetch material receipt ERROR:', error);
    res.status(500).json({ message: 'Failed to fetch material receipt record', error: error.message });
  }
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, receipt_no, quantity, rate, supplier_name, date } = req.body;
  const totalAmount = Number(quantity) * Number(rate || 0);

  try {
    const [[material]] = await db.promise().query(
      'SELECT id, material_name, material_code, unit FROM material_master WHERE id = ?',
      [materialId]
    );

    if (!material) {
      return res.status(400).json({ message: 'Selected material was not found in material master.' });
    }

    const [result] = await db.promise().query(
      `INSERT INTO material_receipt (material_id, material_name, material_code, unit, receipt_no, quantity, rate, total_amount, supplier_name, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       receipt_no || null, Number(quantity), Number(rate || 0), totalAmount, String(supplier_name).trim(), date]
    );

    await refreshMaterialLedger();

    res.status(201).json({ id: result.insertId, message: 'Material receipt added successfully' });
  } catch (error) {
    console.error('CREATE material receipt ERROR:', error);
    res.status(500).json({ message: 'Failed to create material receipt record', error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, receipt_no, quantity, rate, supplier_name, date } = req.body;
  const totalAmount = Number(quantity) * Number(rate || 0);

  try {
    const [[material]] = await db.promise().query(
      'SELECT id, material_name, material_code, unit FROM material_master WHERE id = ?',
      [materialId]
    );

    if (!material) {
      return res.status(400).json({ message: 'Selected material was not found in material master.' });
    }

    const [result] = await db.promise().query(
      `UPDATE material_receipt
       SET material_id = ?, material_name = ?, material_code = ?, unit = ?,
           receipt_no = ?, quantity = ?, rate = ?, total_amount = ?, supplier_name = ?, date = ?
       WHERE id = ?`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       receipt_no || null, Number(quantity), Number(rate || 0), totalAmount, String(supplier_name).trim(), date, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material receipt record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Material receipt updated successfully' });
  } catch (error) {
    console.error('UPDATE material receipt ERROR:', error);
    res.status(500).json({ message: 'Failed to update material receipt record', error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.promise().query('DELETE FROM material_receipt WHERE id = ?', [req.params.id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material receipt record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Material receipt deleted successfully' });
  } catch (error) {
    console.error('DELETE material receipt ERROR:', error);
    res.status(500).json({ message: 'Failed to delete material receipt record', error: error.message });
  }
});


module.exports = router;
