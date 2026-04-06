const db = require('../db');

async function refreshMaterialLedger() {
  await db.promise().query('DELETE FROM material_ledger');

  await db.promise().query(`
    INSERT INTO material_ledger (
      source_id, source_type, material_id, material_name, material_code, unit,
      transaction_date, inward_quantity, outward_quantity, party_name
    )
    SELECT
      os.id AS source_id,
      'Opening Stock' AS source_type,
      os.material_id,
      mm.material_name,
      mm.material_code,
      mm.unit,
      os.date AS transaction_date,
      os.quantity AS inward_quantity,
      0 AS outward_quantity,
      NULL AS party_name
    FROM opening_stock os
    INNER JOIN material_master mm ON mm.id = os.material_id
  `);

  await db.promise().query(`
    INSERT INTO material_ledger (
      source_id, source_type, material_id, material_name, material_code, unit,
      transaction_date, inward_quantity, outward_quantity, party_name
    )
    SELECT
      mr.id AS source_id,
      'Material Receipt' AS source_type,
      mr.material_id,
      mm.material_name,
      mm.material_code,
      mm.unit,
      mr.date AS transaction_date,
      mr.quantity AS inward_quantity,
      0 AS outward_quantity,
      mr.supplier_name AS party_name
    FROM material_receipt mr
    INNER JOIN material_master mm ON mm.id = mr.material_id
  `);

  await db.promise().query(`
    INSERT INTO material_ledger (
      source_id, source_type, material_id, material_name, material_code, unit,
      transaction_date, inward_quantity, outward_quantity, party_name
    )
    SELECT
      mi.id AS source_id,
      'Material Issue' AS source_type,
      mi.material_id,
      mm.material_name,
      mm.material_code,
      mm.unit,
      mi.date AS transaction_date,
      0 AS inward_quantity,
      mi.quantity AS outward_quantity,
      mi.issued_to AS party_name
    FROM material_issue mi
    INNER JOIN material_master mm ON mm.id = mi.material_id
  `);
}

module.exports = {
  refreshMaterialLedger,
};
