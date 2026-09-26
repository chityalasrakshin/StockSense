import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public';

  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL for rollback.');

  const rollbackSqlPath = path.resolve(__dirname, '../database/rollback.sql');
  const sql = fs.readFileSync(rollbackSqlPath, 'utf-8');

  console.log('Executing rollback.sql...');
  await client.query(sql);

  console.log(
    '✓ Migration successfully rolled back. All tables, enums, and extensions dropped cleanly.',
  );
  await client.end();
}

main().catch((err) => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
