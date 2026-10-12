
import EmbeddedPostgres from 'embedded-postgres';
import { mkdirSync } from 'node:fs';
const dataDir = '/home/user/.pgdata';
mkdirSync(dataDir, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'merchantos', password: 'merchantos', port: 5432, persistent: true,
});
await pg.initialise();
await pg.start();
try { await pg.createDatabase('merchantos'); } catch (e) { /* exists */ }
console.log('PG ready on 5432');
setInterval(() => {}, 60000);
