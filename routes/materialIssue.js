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

  if (!body.issued_to || !String(body.issued_to).trim()) {
    errors.push('issued_to is required');
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
      whereClause = `WHERE mm.material_name LIKE ? OR mm.material_code LIKE ? OR mi.issue_no LIKE ? OR mi.issued_to LIKE ? OR mi.purpose LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    const [[{ total }]] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM material_issue mi
       INNER JOIN material_master mm ON mm.id = mi.material_id
       ${whereClause}`,
      params
    );

    const [rows] = await db.promise().query(
      `SELECT mi.id, mi.material_id, mm.material_name, mm.material_code, mm.unit,
              mi.issue_no, mi.quantity, mi.issued_to, mi.purpose, mi.date
       FROM material_issue mi
       INNER JOIN material_master mm ON mm.id = mi.material_id
       ${whereClause}
       ORDER BY mi.date DESC, mi.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material issue records', error: error.message });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT mi.id, mi.material_id, mm.material_name, mm.material_code, mm.unit,
              mi.issue_no, mi.quantity, mi.issued_to, mi.purpose, mi.date
       FROM material_issue mi
       INNER JOIN material_master mm ON mm.id = mi.material_id
       WHERE mi.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Material issue record not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material issue record', error: error.message });
  }
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, issue_no, quantity, issued_to, purpose, date } = req.body;

  try {
    const [[material]] = await db.promise().query(
      'SELECT id, material_name, material_code, unit FROM material_master WHERE id = ?',
      [materialId]
    );

    if (!material) {
      return res.status(400).json({ message: 'Selected material was not found in material master.' });
    }

    const [result] = await db.promise().query(
      `INSERT INTO material_issue (material_id, material_name, material_code, unit, issue_no, quantity, issued_to, purpose, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       issue_no || null, Number(quantity), String(issued_to).trim(), String(purpose || '').trim(), date]
    );

    await refreshMaterialLedger();

    res.status(201).json({ id: result.insertId, message: 'Material issue added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create material issue record', error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const { material_id: materialId, issue_no, quantity, issued_to, purpose, date } = req.body;

  try {
    const [[material]] = await db.promise().query(
      'SELECT id, material_name, material_code, unit FROM material_master WHERE id = ?',
      [materialId]
    );

    if (!material) {
      return res.status(400).json({ message: 'Selected material was not found in material master.' });
    }

    const [result] = await db.promise().query(
      `UPDATE material_issue
       SET material_id = ?, material_name = ?, material_code = ?, unit = ?,
           issue_no = ?, quantity = ?, issued_to = ?, purpose = ?, date = ?
       WHERE id = ?`,
      [Number(materialId), material.material_name, material.material_code, material.unit,
       issue_no || null, Number(quantity), String(issued_to).trim(), String(purpose || '').trim(), date, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material issue record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Material issue updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update material issue record', error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.promise().query('DELETE FROM material_issue WHERE id = ?', [req.params.id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material issue record not found' });
    }

    await refreshMaterialLedger();

    res.json({ message: 'Material issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete material issue record', error: error.message });
  }
});

module.exports = router;
