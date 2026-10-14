import pg from 'pg';
import { optimizeImageDataUrl, optimizeImageArray } from './imageOptimizer.js';

const { Pool } = pg;

export async function runDatabaseStorageCleanup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not defined. Skipping cleanup.');
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('--- Starting Neon PostgreSQL Storage Optimization ---');
    const initialSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`Initial total database size: ${initialSize.rows[0].size}`);

    // 1. Optimize OwnedFigure
    console.log('Optimizing OwnedFigure photos...');
    const ownedRows = await pool.query(`
      SELECT id, notes FROM "OwnedFigure"
      WHERE notes LIKE '%data:image%'
    `);
    console.log(`Found ${ownedRows.rows.length} OwnedFigure records with base64 images.`);

    for (const row of ownedRows.rows) {
      if (!row.notes) continue;
      try {
        let meta: any = null;
        if (row.notes.startsWith('{"__cardbackMeta"')) {
          meta = JSON.parse(row.notes);
        }
        if (meta) {
          let modified = false;
          if (meta.figureImageUrl && meta.figureImageUrl.startsWith('data:image')) {
            const beforeLen = meta.figureImageUrl.length;
            meta.figureImageUrl = await optimizeImageDataUrl(meta.figureImageUrl, 800, 75);
            if (meta.figureImageUrl.length < beforeLen) modified = true;
          }
          if (Array.isArray(meta.images) && meta.images.length > 0) {
            const optimizedImages = await optimizeImageArray(meta.images, 800, 75);
            meta.images = optimizedImages;
            modified = true;
          }
          if (modified) {
            const updatedNotes = JSON.stringify(meta);
            await pool.query(`
              UPDATE "OwnedFigure"
              SET notes = $1, "updatedAt" = NOW()
              WHERE id = $2
            `, [updatedNotes, row.id]);
            console.log(`  Updated OwnedFigure ${row.id}: ${row.notes.length} chars -> ${updatedNotes.length} chars`);
          }
        }
      } catch (err) {
        console.warn(`  Could not parse or optimize row ${row.id}:`, err);
      }
    }

    // 2. Optimize Figure
    console.log('Optimizing Figure imageUrls...');
    const figRows = await pool.query(`
      SELECT id, "imageUrl" FROM "Figure"
      WHERE "imageUrl" LIKE 'data:image%'
    `);
    console.log(`Found ${figRows.rows.length} Figure records with base64 images.`);
    for (const row of figRows.rows) {
      if (!row.imageUrl) continue;
      const optimized = await optimizeImageDataUrl(row.imageUrl, 800, 75);
      if (optimized.length < row.imageUrl.length) {
        await pool.query(`
          UPDATE "Figure" SET "imageUrl" = $1, "updatedAt" = NOW() WHERE id = $2
        `, [optimized, row.id]);
        console.log(`  Updated Figure ${row.id}: ${row.imageUrl.length} chars -> ${optimized.length} chars`);
      }
    }

    // 3. Optimize Variant
    console.log('Optimizing Variant imageUrls...');
    const varRows = await pool.query(`
      SELECT id, "imageUrl" FROM "Variant"
      WHERE "imageUrl" LIKE 'data:image%'
    `);
    console.log(`Found ${varRows.rows.length} Variant records with base64 images.`);
    for (const row of varRows.rows) {
      if (!row.imageUrl) continue;
      const optimized = await optimizeImageDataUrl(row.imageUrl, 800, 75);
      if (optimized.length < row.imageUrl.length) {
        await pool.query(`
          UPDATE "Variant" SET "imageUrl" = $1, "updatedAt" = NOW() WHERE id = $2
        `, [optimized, row.id]);
        console.log(`  Updated Variant ${row.id}: ${row.imageUrl.length} chars -> ${optimized.length} chars`);
      }
    }

    // 4. Optimize ProductRelease
    console.log('Optimizing ProductRelease imageUrls...');
    const prRows = await pool.query(`
      SELECT id, "imageUrl" FROM "ProductRelease"
      WHERE "imageUrl" LIKE 'data:image%'
    `);
    console.log(`Found ${prRows.rows.length} ProductRelease records with base64 images.`);
    for (const row of prRows.rows) {
      if (!row.imageUrl) continue;
      const optimized = await optimizeImageDataUrl(row.imageUrl, 800, 75);
      if (optimized.length < row.imageUrl.length) {
        await pool.query(`
          UPDATE "ProductRelease" SET "imageUrl" = $1, "updatedAt" = NOW() WHERE id = $2
        `, [optimized, row.id]);
        console.log(`  Updated ProductRelease ${row.id}: ${row.imageUrl.length} chars -> ${optimized.length} chars`);
      }
    }

    // 5. Reclaim disk space with VACUUM FULL
    console.log('Reclaiming storage via VACUUM FULL...');
    await pool.query('VACUUM FULL "OwnedFigure"');
    await pool.query('VACUUM FULL "Figure"');
    await pool.query('VACUUM FULL "Variant"');
    await pool.query('VACUUM FULL "ProductRelease"');

    const finalSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`Optimization complete! New total database size: ${finalSize.rows[0].size} (was ${initialSize.rows[0].size})`);

    const tableSizes = await pool.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS total_size
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY pg_total_relation_size('"' || table_schema || '"."' || table_name || '"') DESC;
    `);
    console.log('New table sizes:', tableSizes.rows);
  } catch (err) {
    console.error('Error during database cleanup:', err);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('cleanupDatabaseStorage.ts')) {
  runDatabaseStorageCleanup().catch(console.error);
}
