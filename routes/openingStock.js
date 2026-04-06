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
      whereClause = `WHERE mm.material_name LIKE ? OR mm.material_code LIKE ? OR mm.unit LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const [[{ total }]] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM opening_stock os
       INNER JOIN material_master mm ON mm.id = os.material_id
       ${whereClause}`,
      params
    );

    const [rows] = await db.promise().query(
      `SELECT os.id, os.material_id, mm.material_name, mm.material_code, mm.unit,
              os.quantity, os.rate, os.total_amount, os.date
       FROM opening_stock os
       INNER JOIN material_master mm ON mm.id = os.material_id
       ${whereClause}
       ORDER BY os.date DESC, os.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch opening stock records', error: error.message });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT os.id, os.material_id, mm.material_name, mm.material_code, mm.unit,
              os.quantity, os.rate, os.total_amount, os.date
       FROM opening_stock os
       INNER JOIN material_master mm ON mm.id = os.material_id
       WHERE os.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Opening stock record not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch opening stock record', error: error.message });
  }
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, quantity, rate, date } = req.body;
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
      `INSERT INTO opening_stock (material_id, material_name, material_code, unit, quantity, rate, total_amount, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       Number(quantity), Number(rate || 0), totalAmount, date]
    );

    await refreshMaterialLedger();

    res.status(201).json({ id: result.insertId, message: 'Opening stock added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create opening stock record', error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, quantity, rate, date } = req.body;
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
      `UPDATE opening_stock
       SET material_id = ?, material_name = ?, material_code = ?, unit = ?,
           quantity = ?, rate = ?, total_amount = ?, date = ?
       WHERE id = ?`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       Number(quantity), Number(rate || 0), totalAmount, date, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Opening stock record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Opening stock updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update opening stock record', error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.promise().query('DELETE FROM opening_stock WHERE id = ?', [req.params.id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Opening stock record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Opening stock deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete opening stock record', error: error.message });
  }
});

module.exports = router;
