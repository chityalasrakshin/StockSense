import * as path from 'path';
import * as fs from 'fs';
import EmbeddedPostgres from 'embedded-postgres';

interface EmbeddedPostgresConstructor {
  new (options?: Record<string, unknown>): {
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  };
}

const Ep = ((EmbeddedPostgres as unknown as { default?: EmbeddedPostgresConstructor }).default ||
  EmbeddedPostgres) as unknown as EmbeddedPostgresConstructor;

const pgDataDir = path.join(__dirname, '..', '.pgdata');

async function main() {
  const pg = new Ep({
    databaseDir: pgDataDir,
    port: 5432,
    user: 'stocksense',
    password: 'stocksense',
    persistent: true,
    onLog: (msg: string) => process.stdout.write(msg),
    onError: (err: unknown) => console.error(err),
  });

  if (!fs.existsSync(path.join(pgDataDir, 'PG_VERSION'))) {
    console.log('Initializing PostgreSQL cluster in', pgDataDir);
    await pg.initialise();
  }

  console.log('Starting PostgreSQL on port 5432...');
  await pg.start();

  try {
    await pg.createDatabase('stocksense');
    console.log('Database "stocksense" created.');
  } catch {
    // Database already exists
  }

  console.log(
    'PostgreSQL 16 is running on localhost:5432 (database: stocksense, user: stocksense)',
  );

  const shutdown = async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  // Keep alive
  setInterval(() => {}, 60000);
}

main().catch((err: unknown) => {
  console.error('Failed to run PostgreSQL:', err);
  process.exit(1);
});
