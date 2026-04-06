const express = require('express');
const router = express.Router();
const db = require('../db');
const { refreshMaterialLedger } = require('../services/ledgerService');

function validatePayload(body) {
  const errors = [];

  if (!body.material_name || !String(body.material_name).trim()) {
    errors.push('material_name is required');
  }

  if (!body.unit || !String(body.unit).trim()) {
    errors.push('unit is required');
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
      `SELECT COUNT(*) AS total FROM material_master mm ${whereClause}`,
      params
    );

    const [rows] = await db.promise().query(
      `
      SELECT
        mm.id,
        mm.material_name,
        mm.material_code,
        mm.unit,
        mm.description,
        mm.created_at,
        (
          COALESCE((SELECT SUM(os.quantity) FROM opening_stock os WHERE os.material_id = mm.id), 0) +
          COALESCE((SELECT SUM(mr.quantity) FROM material_receipt mr WHERE mr.material_id = mm.id), 0) -
          COALESCE((SELECT SUM(mi.quantity) FROM material_issue mi WHERE mi.material_id = mm.id), 0)
        ) AS current_stock
      FROM material_master mm
      ${whereClause}
      ORDER BY mm.material_name ASC, mm.id ASC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), offset]
    );

    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material master records', error: error.message });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        mm.id,
        mm.material_name,
        mm.material_code,
        mm.unit,
        mm.description,
        mm.created_at,
        (
          COALESCE((SELECT SUM(os.quantity) FROM opening_stock os WHERE os.material_id = mm.id), 0) +
          COALESCE((SELECT SUM(mr.quantity) FROM material_receipt mr WHERE mr.material_id = mm.id), 0) -
          COALESCE((SELECT SUM(mi.quantity) FROM material_issue mi WHERE mi.material_id = mm.id), 0)
        ) AS current_stock
      FROM material_master mm
      WHERE mm.id = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Material master record not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material master record', error: error.message });
  }
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const materialName = String(req.body.material_name).trim();
  const materialCode = String(req.body.material_code || '').trim();
  const unit = String(req.body.unit).trim();
  const description = String(req.body.description || '').trim();

  try {
    const [duplicateRows] = await db.promise().query(
      'SELECT id FROM material_master WHERE material_name = ? AND unit = ?',
      [materialName, unit]
    );

    if (duplicateRows.length) {
      return res.status(400).json({ message: 'Material master already exists for this material name and unit.' });
    }

    const [result] = await db.promise().query(
      `INSERT INTO material_master (material_name, material_code, unit, description)
       VALUES (?, ?, ?, ?)`,
      [materialName, materialCode, unit, description]
    );

    await refreshMaterialLedger();

    res.status(201).json({ id: result.insertId, message: 'Material master added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create material master record', error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const materialName = String(req.body.material_name).trim();
  const materialCode = String(req.body.material_code || '').trim();
  const unit = String(req.body.unit).trim();
  const description = String(req.body.description || '').trim();

  try {
    const [duplicateRows] = await db.promise().query(
      'SELECT id FROM material_master WHERE material_name = ? AND unit = ? AND id <> ?',
      [materialName, unit, req.params.id]
    );

    if (duplicateRows.length) {
      return res.status(400).json({ message: 'Another material master already uses this material name and unit.' });
    }

    const [result] = await db.promise().query(
      `UPDATE material_master
       SET material_name = ?, material_code = ?, unit = ?, description = ?
       WHERE id = ?`,
      [materialName, materialCode, unit, description, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material master record not found' });
    }

    // Cascade name/code/unit changes to child tables
    await db.promise().query(
      `UPDATE opening_stock SET material_name = ?, material_code = ?, unit = ? WHERE material_id = ?`,
      [materialName, materialCode, unit, req.params.id]
    );
    await db.promise().query(
      `UPDATE material_receipt SET material_name = ?, material_code = ?, unit = ? WHERE material_id = ?`,
      [materialName, materialCode, unit, req.params.id]
    );
    await db.promise().query(
      `UPDATE material_issue SET material_name = ?, material_code = ?, unit = ? WHERE material_id = ?`,
      [materialName, materialCode, unit, req.params.id]
    );
    await refreshMaterialLedger();

    res.json({ message: 'Material master updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update material master record', error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const [[usage]] = await db.promise().query(
      `
      SELECT
        (SELECT COUNT(*) FROM opening_stock WHERE material_id = ?) +
        (SELECT COUNT(*) FROM material_receipt WHERE material_id = ?) +
        (SELECT COUNT(*) FROM material_issue WHERE material_id = ?) AS total_usage
      `,
      [req.params.id, req.params.id, req.params.id]
    );

    if (Number(usage.total_usage || 0) > 0) {
      return res.status(400).json({ message: 'Material master is already used in transactions and cannot be deleted.' });
    }

    const [result] = await db.promise().query('DELETE FROM material_master WHERE id = ?', [req.params.id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Material master record not found' });
    }

    res.json({ message: 'Material master deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete material master record', error: error.message });
  }
});

module.exports = router;
