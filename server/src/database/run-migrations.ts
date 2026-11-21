// `npm run migrate`: applies pending migrations (used by deploy pipelines).
import { createDataSource } from './data-source';

(async () => {
  const ds = await createDataSource().initialize();
  const applied = await ds.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Migrations appliquées : ${applied.map((m) => m.name).join(', ')}` : 'Base à jour.');
  await ds.destroy();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
