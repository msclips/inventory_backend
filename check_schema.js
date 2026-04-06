const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_db',
  });

  const tables = ['material_master', 'material_receipt', 'material_ledger'];
  
  for (const table of tables) {
    console.log(`\n--- Schema for ${table} ---`);
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    console.table(columns);
  }

  await connection.end();
}

checkSchema().catch(err => {
  console.error('Failed to check schema:', err.message);
  process.exit(1);
});
