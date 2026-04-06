const db = require('../db');

async function getAvailableStock(materialId, excludedIssueId = null) {
  const [openingRows] = await db.promise().query(
    `SELECT COALESCE(SUM(quantity), 0) AS total_quantity
     FROM opening_stock
     WHERE material_id = ?`,
    [materialId]
  );

  const [receiptRows] = await db.promise().query(
    `SELECT COALESCE(SUM(quantity), 0) AS total_quantity
     FROM material_receipt
     WHERE material_id = ?`,
    [materialId]
  );

  const issueParams = [materialId];
  let issueQuery = `
    SELECT COALESCE(SUM(quantity), 0) AS total_quantity
    FROM material_issue
    WHERE material_id = ?
  `;

  if (excludedIssueId) {
    issueQuery += ' AND id <> ?';
    issueParams.push(excludedIssueId);
  }

  const [issueRows] = await db.promise().query(issueQuery, issueParams);

  return (
    Number(openingRows[0].total_quantity || 0) +
    Number(receiptRows[0].total_quantity || 0) -
    Number(issueRows[0].total_quantity || 0)
  );
}

module.exports = {
  getAvailableStock,
};
