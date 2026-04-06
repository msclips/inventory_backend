const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = require('./db');
const { refreshMaterialLedger } = require('./services/ledgerService');

const dashboardRoutes = require('./routes/dashboard');
const materialMasterRoutes = require('./routes/materialMaster');
const openingStockRoutes = require('./routes/openingStock');
const materialReceiptRoutes = require('./routes/materialReceipt');
const materialIssueRoutes = require('./routes/materialIssue');
const reportsRoutes = require('./routes/reports');

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/material-master', materialMasterRoutes);
app.use('/api/opening-stock', openingStockRoutes);
app.use('/api/material-receipt', materialReceiptRoutes);
app.use('/api/material-issue', materialIssueRoutes);
app.use('/api/reports', reportsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

async function columnExists(tableName, columnName) {
  const [rows] = await db.promise().query(
    `
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [process.env.DB_NAME || 'inventory_db', tableName, columnName]
  );

  return Number(rows[0].total) > 0;
}

async function addColumnIfMissing(tableName, columnDefinition, columnName) {
  const exists = await columnExists(tableName, columnName);

  if (!exists) {
    await db.promise().query(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

async function initializeDatabase() {
  const adminConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  await adminConnection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'inventory_db'}`);
  await adminConnection.end();

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS material_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_name VARCHAR(255) NOT NULL,
      material_code VARCHAR(100) NULL,
      unit VARCHAR(50) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_material_master_name_unit (material_name, unit)
    )
  `);

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS opening_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      material_name VARCHAR(255) NULL,
      material_code VARCHAR(100) NULL,
      unit VARCHAR(50) NULL,
      quantity DECIMAL(10,2) NOT NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      date DATE NOT NULL
    )
  `);

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS material_receipt (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      material_name VARCHAR(255) NULL,
      material_code VARCHAR(100) NULL,
      unit VARCHAR(50) NULL,
      receipt_no VARCHAR(100) NULL,
      quantity DECIMAL(10,2) NOT NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      supplier VARCHAR(255) NULL,
      supplier_name VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    )
  `);

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS material_issue (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      material_name VARCHAR(255) NULL,
      material_code VARCHAR(100) NULL,
      unit VARCHAR(50) NULL,
      issue_no VARCHAR(100) NULL,
      quantity DECIMAL(10,2) NOT NULL,
      issued_to VARCHAR(255) NOT NULL,
      purpose VARCHAR(255) NULL,
      date DATE NOT NULL
    )
  `);

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS material_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id INT NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      material_id INT NOT NULL,
      material_name VARCHAR(255) NOT NULL,
      material_code VARCHAR(100) NULL,
      unit VARCHAR(50) NOT NULL,
      transaction_date DATE NOT NULL,
      inward_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      outward_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      party_name VARCHAR(255) NULL
    )
  `);

  // Add new columns to existing tables
  await addColumnIfMissing('material_master', 'material_code VARCHAR(100) NULL', 'material_code');
  await addColumnIfMissing('material_master', 'description TEXT NULL', 'description');
  await addColumnIfMissing('material_master', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'created_at');

  await addColumnIfMissing('opening_stock', 'material_id INT NULL', 'material_id');
  await addColumnIfMissing('opening_stock', 'material_name VARCHAR(255) NULL', 'material_name');
  await addColumnIfMissing('opening_stock', 'material_code VARCHAR(100) NULL', 'material_code');
  await addColumnIfMissing('opening_stock', 'unit VARCHAR(50) NULL', 'unit');
  await addColumnIfMissing('opening_stock', 'rate DECIMAL(10,2) NOT NULL DEFAULT 0', 'rate');
  await addColumnIfMissing('opening_stock', 'total_amount DECIMAL(14,2) NOT NULL DEFAULT 0', 'total_amount');

  await addColumnIfMissing('material_receipt', 'material_id INT NULL', 'material_id');
  await addColumnIfMissing('material_receipt', 'material_name VARCHAR(255) NULL', 'material_name');
  await addColumnIfMissing('material_receipt', 'material_code VARCHAR(100) NULL', 'material_code');
  await addColumnIfMissing('material_receipt', 'unit VARCHAR(50) NULL', 'unit');
  await addColumnIfMissing('material_receipt', 'receipt_no VARCHAR(100) NULL', 'receipt_no');
  await addColumnIfMissing('material_receipt', 'rate DECIMAL(10,2) NOT NULL DEFAULT 0', 'rate');
  await addColumnIfMissing('material_receipt', 'total_amount DECIMAL(14,2) NOT NULL DEFAULT 0', 'total_amount');
  await addColumnIfMissing('material_receipt', 'supplier_name VARCHAR(255) NULL', 'supplier_name');

  await addColumnIfMissing('material_issue', 'material_id INT NULL', 'material_id');
  await addColumnIfMissing('material_issue', 'material_name VARCHAR(255) NULL', 'material_name');
  await addColumnIfMissing('material_issue', 'material_code VARCHAR(100) NULL', 'material_code');
  await addColumnIfMissing('material_issue', 'unit VARCHAR(50) NULL', 'unit');
  await addColumnIfMissing('material_issue', 'issue_no VARCHAR(100) NULL', 'issue_no');
  await addColumnIfMissing('material_issue', 'purpose VARCHAR(255) NULL', 'purpose');

  await addColumnIfMissing('material_ledger', 'material_code VARCHAR(100) NULL', 'material_code');

  // Fix: Make legacy 'supplier' column optional to prevent insert failures
  const hasOldSupplierRaw = await columnExists('material_receipt', 'supplier');
  if (hasOldSupplierRaw) {
    await db.promise().query(`ALTER TABLE material_receipt MODIFY COLUMN supplier VARCHAR(255) NULL`);
  }

  // Migrate existing supplier -> supplier_name if supplier column exists
  const hasOldSupplier = await columnExists('material_receipt', 'supplier');
  const hasNewSupplier = await columnExists('material_receipt', 'supplier_name');
  if (hasOldSupplier && hasNewSupplier) {
    await db.promise().query(`
      UPDATE material_receipt SET supplier_name = supplier
      WHERE supplier_name IS NULL AND supplier IS NOT NULL
    `);
  }


  // Sync material_id for legacy data
  await db.promise().query(`
    INSERT IGNORE INTO material_master (material_name, unit)
    SELECT material_name, unit FROM opening_stock
    WHERE material_name IS NOT NULL AND unit IS NOT NULL
  `);
  await db.promise().query(`
    INSERT IGNORE INTO material_master (material_name, unit)
    SELECT material_name, unit FROM material_receipt
    WHERE material_name IS NOT NULL AND unit IS NOT NULL
  `);
  await db.promise().query(`
    INSERT IGNORE INTO material_master (material_name, unit)
    SELECT material_name, unit FROM material_issue
    WHERE material_name IS NOT NULL AND unit IS NOT NULL
  `);

  await db.promise().query(`
    UPDATE opening_stock os
    INNER JOIN material_master mm ON mm.material_name = os.material_name AND mm.unit = os.unit
    SET os.material_id = mm.id
    WHERE os.material_id IS NULL
  `);
  await db.promise().query(`
    UPDATE material_receipt mr
    INNER JOIN material_master mm ON mm.material_name = mr.material_name AND mm.unit = mr.unit
    SET mr.material_id = mm.id
    WHERE mr.material_id IS NULL
  `);
  await db.promise().query(`
    UPDATE material_issue mi
    INNER JOIN material_master mm ON mm.material_name = mi.material_name AND mm.unit = mi.unit
    SET mi.material_id = mm.id
    WHERE mi.material_id IS NULL
  `);

  await refreshMaterialLedger();
}

async function startServer() {
  try {
    await initializeDatabase();
    console.log('Connected to MySQL and initialized inventory_db');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

startServer();
