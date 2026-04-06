const express = require('express');
const router = express.Router();
const db = require('../db');

function buildDateFilter(columnName, fromDate, toDate, params) {
  const conditions = [];

  if (fromDate) {
    conditions.push(`${columnName} >= ?`);
    params.push(fromDate);
  }

  if (toDate) {
    conditions.push(`${columnName} <= ?`);
    params.push(toDate);
  }

  return conditions;
}

// Material Statement Report — shows per-material summary + ledger detail
router.get('/material-statement', async (req, res) => {
  const { material_id: materialId, from_date: fromDate, to_date: toDate } = req.query;
  const params = [];
  const conditions = [];

  if (materialId) {
    conditions.push('material_id = ?');
    params.push(materialId);
  }

  conditions.push(...buildDateFilter('transaction_date', null, toDate, params));

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        id,
        source_id,
        material_id,
        material_name,
        material_code,
        unit,
        transaction_date,
        source_type AS transaction_type,
        inward_quantity,
        outward_quantity,
        party_name
      FROM material_ledger
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY material_name ASC, transaction_date ASC, id ASC
      `,
      params
    );

    const balances = {};
    const report = rows
      .map((row) => {
        const key = `${row.material_id}__${row.unit}`;
        const currentBalance = balances[key] || 0;
        const nextBalance = currentBalance + Number(row.inward_quantity) - Number(row.outward_quantity);
        balances[key] = nextBalance;

        return {
          ...row,
          running_balance: nextBalance,
        };
      })
      .filter((row) => {
        if (fromDate && String(row.transaction_date).slice(0, 10) < fromDate) {
          return false;
        }
        return true;
      });

    // Build per-material summary
    const summaryMap = {};
    rows.forEach((row) => {
      const key = `${row.material_id}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          material_id: row.material_id,
          material_name: row.material_name,
          material_code: row.material_code,
          unit: row.unit,
          opening_stock: 0,
          total_receipt: 0,
          total_issue: 0,
          closing_stock: 0,
        };
      }
      const s = summaryMap[key];
      if (row.transaction_type === 'Opening Stock') {
        s.opening_stock += Number(row.inward_quantity);
      } else if (row.transaction_type === 'Material Receipt') {
        s.total_receipt += Number(row.inward_quantity);
      } else if (row.transaction_type === 'Material Issue') {
        s.total_issue += Number(row.outward_quantity);
      }
    });

    const summary = Object.values(summaryMap).map((s) => ({
      ...s,
      closing_stock: s.opening_stock + s.total_receipt - s.total_issue,
    }));

    res.json({ detail: report, summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material statement report', error: error.message });
  }
});

// Material Issue Report — summary grouped by material + issued_to
router.get('/material-issue', async (req, res) => {
  const { material_id: materialId, issued_to: issuedTo, from_date: fromDate, to_date: toDate } = req.query;
  const params = [];
  const conditions = [];

  if (materialId) {
    conditions.push('mi.material_id = ?');
    params.push(materialId);
  }

  if (issuedTo) {
    conditions.push('mi.issued_to LIKE ?');
    params.push(`%${issuedTo}%`);
  }

  conditions.push(...buildDateFilter('mi.date', fromDate, toDate, params));

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        mi.material_id,
        mm.material_name,
        mm.material_code,
        mm.unit,
        mi.issued_to,
        COUNT(*) AS transaction_count,
        SUM(mi.quantity) AS total_quantity,
        MIN(mi.date) AS first_issue_date,
        MAX(mi.date) AS last_issue_date
      FROM material_issue mi
      INNER JOIN material_master mm ON mm.id = mi.material_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY mi.material_id, mm.material_name, mm.material_code, mm.unit, mi.issued_to
      ORDER BY last_issue_date DESC, mm.material_name ASC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material issue report', error: error.message });
  }
});

// Material Issue Detail Report — each issue entry with material-wise grouping
router.get('/material-issue-detail', async (req, res) => {
  const { material_id: materialId, issued_to: issuedTo, from_date: fromDate, to_date: toDate } = req.query;
  const params = [];
  const conditions = [];

  if (materialId) {
    conditions.push('mi.material_id = ?');
    params.push(materialId);
  }

  if (issuedTo) {
    conditions.push('mi.issued_to LIKE ?');
    params.push(`%${issuedTo}%`);
  }

  conditions.push(...buildDateFilter('mi.date', fromDate, toDate, params));

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        mi.id,
        mi.issue_no,
        mi.material_id,
        mm.material_name,
        mm.material_code,
        mm.unit,
        mi.quantity,
        mi.issued_to,
        mi.purpose,
        mi.date
      FROM material_issue mi
      INNER JOIN material_master mm ON mm.id = mi.material_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY mm.material_name ASC, mi.date DESC, mi.id DESC
      `,
      params
    );

    // Group by material with totals
    const grouped = {};
    rows.forEach((row) => {
      const key = `${row.material_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          material_id: row.material_id,
          material_name: row.material_name,
          material_code: row.material_code,
          unit: row.unit,
          total_quantity: 0,
          items: [],
        };
      }
      grouped[key].total_quantity += Number(row.quantity);
      grouped[key].items.push(row);
    });

    res.json({
      detail: rows,
      grouped: Object.values(grouped),
      grand_total: rows.reduce((sum, r) => sum + Number(r.quantity), 0),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch material issue detail report', error: error.message });
  }
});

module.exports = router;
