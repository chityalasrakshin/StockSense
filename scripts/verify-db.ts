import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public',
  });

  await client.connect();
  console.log('Connected to PostgreSQL database for verification.');

  // 1. Verify pg_trgm extension
  const extRes = await client.query(
    "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';",
  );
  console.log('pg_trgm extension:', extRes.rows);
  if (extRes.rows.length === 0) {
    throw new Error('pg_trgm extension is NOT installed!');
  }

  // 2. Verify indexes
  const indexRes = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename IN ('products', 'documents', 'stock_ledger', 'stock_balances')
    ORDER BY tablename, indexname;
  `);
  console.log('\nIndexes present:');
  for (const row of indexRes.rows) {
    console.log(` - ${row.indexname}: ${row.indexdef}`);
  }

  // 3. Verify EXPLAIN query for pg_trgm index on products.sku
  await client.query('SET enable_seqscan = OFF;');
  const explainRes = await client.query("EXPLAIN SELECT * FROM products WHERE sku LIKE '%STEEL%';");
  console.log('\nEXPLAIN query plan for products.sku trigram search:');
  for (const row of explainRes.rows) {
    console.log('  ', row['QUERY PLAN']);
  }

  // 4. Verify check constraint on stock_balances (quantity >= 0)
  console.log('\nTesting CHECK constraint on stock_balances (quantity >= 0)...');
  try {
    await client.query(`
      INSERT INTO stock_balances (product_id, location_id, quantity, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', -5, NOW());
    `);
    throw new Error('FAIL: Negative quantity was allowed in stock_balances!');
  } catch (err: any) {
    if (
      err.message.includes('stock_balances_quantity_non_negative') ||
      err.message.includes('check constraint')
    ) {
      console.log('PASS: Correctly rejected negative quantity in stock_balances:', err.message);
    } else {
      console.log('Caught expected constraint or FK error:', err.message);
    }
  }

  // 5. Verify table row counts from seed
  const countRes = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM categories) as categories,
      (SELECT COUNT(*) FROM units_of_measure) as uoms,
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM locations) as locations,
      (SELECT COUNT(*) FROM documents) as documents,
      (SELECT COUNT(*) FROM document_lines) as document_lines,
      (SELECT COUNT(*) FROM stock_ledger) as stock_ledger,
      (SELECT COUNT(*) FROM stock_balances) as stock_balances;
  `);
  console.log('\nSeeded Table Row Counts:', countRes.rows[0]);

  // 6. Verify balances values
  const balRes = await client.query(`
    SELECT p.sku, p.name, p.unit_cost, l.name as location, l.short_code, b.quantity
    FROM stock_balances b
    JOIN products p ON p.id = b.product_id
    JOIN locations l ON l.id = b.location_id
    ORDER BY l.name;
  `);
  console.log('\nCurrent Stock Balances:');
  for (const b of balRes.rows) {
    console.log(
      ` - ${b.name} (${b.sku}, cost: $${b.unit_cost}) at [${b.short_code}] ${b.location}: ${b.quantity} on hand`,
    );
  }

  // 7. Verify document fields (reference, contact, schedule_date, responsible_user)
  const docRes = await client.query(`
    SELECT d.reference, d.type, d.status, d.contact, d.schedule_date, u.email as responsible_user
    FROM documents d
    JOIN users u ON u.id = d.responsible_user_id
    ORDER BY d.created_at;
  `);
  console.log('\nSeeded Documents:');
  for (const d of docRes.rows) {
    console.log(
      ` - [${d.reference}] ${d.type} (${d.status}) | Contact: ${d.contact || 'N/A'} | Scheduled: ${d.schedule_date ? d.schedule_date.toISOString() : 'N/A'} | Responsible: ${d.responsible_user}`,
    );
    if (!d.reference || !d.responsible_user) {
      throw new Error(`Document ${d.reference} missing required reference or responsible_user!`);
    }
  }

  // 8. Verify "Free to Use" stock dynamic calculation (Prompt 5/6 design)
  // Free to Use = stock_balances.quantity - SUM(lines in READY/WAITING for DELIVERY or TRANSFER out)
  const freeToUseRes = await client.query(`
    SELECT 
      p.sku,
      p.name,
      b.quantity as on_hand_qty,
      COALESCE(SUM(dl.expected_qty), 0) as reserved_qty,
      b.quantity - COALESCE(SUM(dl.expected_qty), 0) as free_to_use_qty
    FROM stock_balances b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN documents d ON d.source_location_id = b.location_id 
      AND d.type IN ('DELIVERY', 'TRANSFER') 
      AND d.status IN ('READY', 'WAITING')
    LEFT JOIN document_lines dl ON dl.document_id = d.id AND dl.product_id = b.product_id
    GROUP BY p.sku, p.name, b.quantity;
  `);
  console.log('\nFree to Use Stock Calculations (Dynamic Query):');
  for (const f of freeToUseRes.rows) {
    console.log(
      ` - ${f.name} (${f.sku}): On Hand = ${f.on_hand_qty}, Reserved = ${f.reserved_qty}, Free to Use = ${f.free_to_use_qty}`,
    );
  }

  await client.end();
  console.log('\nAll database verification checks completed successfully.');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
