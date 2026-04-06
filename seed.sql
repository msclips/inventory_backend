USE inventory_db;

-- Sample Materials
INSERT INTO material_master (material_name, material_code, unit, description) VALUES
('Cement', 'MAT-001', 'Bag', 'OPC 53 Grade Cement'),
('Steel TMT Bar', 'MAT-002', 'Kg', '12mm TMT Reinforcement Bar'),
('Sand', 'MAT-003', 'CFT', 'River Sand for Construction'),
('Bricks', 'MAT-004', 'Nos', 'Red Clay Bricks Standard Size'),
('Paint', 'MAT-005', 'Ltr', 'Exterior Emulsion Paint');

-- Sample Opening Stock
INSERT INTO opening_stock (material_id, material_name, material_code, unit, quantity, rate, total_amount, date) VALUES
(1, 'Cement', 'MAT-001', 'Bag', 500, 380.00, 190000.00, '2026-01-01'),
(2, 'Steel TMT Bar', 'MAT-002', 'Kg', 2000, 72.50, 145000.00, '2026-01-01'),
(3, 'Sand', 'MAT-003', 'CFT', 1000, 45.00, 45000.00, '2026-01-01'),
(4, 'Bricks', 'MAT-004', 'Nos', 10000, 8.50, 85000.00, '2026-01-01'),
(5, 'Paint', 'MAT-005', 'Ltr', 200, 320.00, 64000.00, '2026-01-01');

-- Sample Material Receipts
INSERT INTO material_receipt (material_id, material_name, material_code, unit, receipt_no, quantity, rate, total_amount, supplier_name, date) VALUES
(1, 'Cement', 'MAT-001', 'Bag', 'REC-001', 200, 385.00, 77000.00, 'UltraTech Dealers', '2026-01-15'),
(2, 'Steel TMT Bar', 'MAT-002', 'Kg', 'REC-002', 500, 74.00, 37000.00, 'Tata Steel Agency', '2026-01-20'),
(3, 'Sand', 'MAT-003', 'CFT', 'REC-003', 500, 46.00, 23000.00, 'River Sand Suppliers', '2026-02-01'),
(1, 'Cement', 'MAT-001', 'Bag', 'REC-004', 300, 390.00, 117000.00, 'ACC Cement Store', '2026-02-10');

-- Sample Material Issues
INSERT INTO material_issue (material_id, material_name, material_code, unit, issue_no, quantity, issued_to, purpose, date) VALUES
(1, 'Cement', 'MAT-001', 'Bag', 'ISS-001', 150, 'Site A Team', 'Foundation Work', '2026-01-18'),
(2, 'Steel TMT Bar', 'MAT-002', 'Kg', 'ISS-002', 800, 'Site B Team', 'Column Reinforcement', '2026-01-25'),
(3, 'Sand', 'MAT-003', 'CFT', 'ISS-003', 300, 'Site A Team', 'Plastering', '2026-02-05'),
(4, 'Bricks', 'MAT-004', 'Nos', 'ISS-004', 4000, 'Site C Team', 'Wall Construction', '2026-02-12'),
(1, 'Cement', 'MAT-001', 'Bag', 'ISS-005', 100, 'Site C Team', 'Slab Casting', '2026-02-15');
