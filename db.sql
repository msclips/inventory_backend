CREATE DATABASE IF NOT EXISTS inventory_db;

USE inventory_db;

CREATE TABLE IF NOT EXISTS material_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_name VARCHAR(255) NOT NULL,
  material_code VARCHAR(100) NULL,
  unit VARCHAR(50) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_material_master_name_unit (material_name, unit)
);

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
);

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
  supplier_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL
);

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
);

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
);

CREATE INDEX idx_opening_stock_material_date ON opening_stock (material_id, date);
CREATE INDEX idx_material_receipt_material_date ON material_receipt (material_id, date);
CREATE INDEX idx_material_issue_material_date ON material_issue (material_id, date);
CREATE INDEX idx_material_ledger_material ON material_ledger (material_id, source_type);
