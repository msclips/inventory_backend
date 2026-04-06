const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [[materialCount]] = await db.promise().query(
      'SELECT COUNT(*) AS total FROM material_master'
    );

    const [[openingTotals]] = await db.promise().query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_qty, COALESCE(SUM(total_amount), 0) AS total_value FROM opening_stock'
    );

    const [[receiptTotals]] = await db.promise().query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_qty, COALESCE(SUM(total_amount), 0) AS total_value FROM material_receipt'
    );

    const [[issueTotals]] = await db.promise().query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM material_issue'
    );

    const [lowStock] = await db.promise().query(`
      SELECT
        mm.id,
        mm.material_name,
        mm.material_code,
        mm.unit,
        (
          COALESCE((SELECT SUM(os.quantity) FROM opening_stock os WHERE os.material_id = mm.id), 0) +
          COALESCE((SELECT SUM(mr.quantity) FROM material_receipt mr WHERE mr.material_id = mm.id), 0) -
          COALESCE((SELECT SUM(mi.quantity) FROM material_issue mi WHERE mi.material_id = mm.id), 0)
        ) AS current_stock
      FROM material_master mm
      ORDER BY current_stock ASC
      LIMIT 5
    `);

    const [recentTransactions] = await db.promise().query(`
      SELECT source_type AS type, material_name, material_code, unit,
             inward_quantity, outward_quantity, party_name, transaction_date
      FROM material_ledger
      ORDER BY transaction_date DESC, id DESC
      LIMIT 10
    `);

    res.json({
      total_materials: materialCount.total,
      total_opening_qty: Number(openingTotals.total_qty),
      total_opening_value: Number(openingTotals.total_value),
      total_received_qty: Number(receiptTotals.total_qty),
      total_received_value: Number(receiptTotals.total_value),
      total_issued_qty: Number(issueTotals.total_qty),
      closing_stock_qty: Number(openingTotals.total_qty) + Number(receiptTotals.total_qty) - Number(issueTotals.total_qty),
      low_stock_materials: lowStock,
      recent_transactions: recentTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
});

module.exports = router;
