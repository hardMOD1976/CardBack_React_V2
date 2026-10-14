import pg from 'pg';

const { Pool } = pg;

/**
 * Script de neteja específica:
 * Esborra ÚNICAMENT els exemples afegits a través de la pàgina de creació/proposta de figures:
 * - Figures que comencen per 'fig-custom-' o 'fig-figura-'
 * - Variants i ProductReleases associades a aquestes figures personalitzades
 * - NO toca en absolut els usuaris ("User")
 * - NO toca el catàleg històric oficial de figures de Star Wars (Kenner 1977-1985, etc.)
 */
export async function cleanFigureCreationExamples() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("DATABASE_URL no està definit.");
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Iniciant neteja dels exemples de la pàgina de creació de figures...");

    // 1. Cercar figures custom/d'exemple
    const customFigs = await pool.query(`
      SELECT id, name FROM "Figure" 
      WHERE id LIKE 'fig-custom-%' 
         OR id LIKE 'fig-figura-%'
         OR code LIKE 'COMM-%'
         OR code LIKE 'BC-%'
    `);
    console.log(`Trobats ${customFigs.rows.length} exemples de creació de figures:`, customFigs.rows.map(r => `${r.id} (${r.name})`));

    if (customFigs.rows.length > 0) {
      const figIds = customFigs.rows.map(r => r.id);

      // 2. Esborrar de OwnedFigure que facin referència a aquestes figures
      const deletedOwned = await pool.query(`
        DELETE FROM "OwnedFigure"
        WHERE "productReleaseId" IN (
          SELECT pr.id FROM "ProductRelease" pr
          JOIN "Variant" v ON pr."variantId" = v.id
          WHERE v."figureId" = ANY($1)
        )
      `, [figIds]);
      console.log(`Esborrats ${deletedOwned.rowCount} registres de col·lecció associats.`);

      // 3. Esborrar ProductRelease associats
      const deletedPr = await pool.query(`
        DELETE FROM "ProductRelease"
        WHERE "variantId" IN (
          SELECT id FROM "Variant" WHERE "figureId" = ANY($1)
        )
      `, [figIds]);
      console.log(`Esborrats ${deletedPr.rowCount} ProductReleases associats.`);

      // 4. Esborrar Variants associades
      const deletedVar = await pool.query(`
        DELETE FROM "Variant" WHERE "figureId" = ANY($1)
      `, [figIds]);
      console.log(`Esborrades ${deletedVar.rowCount} Variants associades.`);

      // 5. Esborrar les Figures d'exemple
      const deletedFigs = await pool.query(`
        DELETE FROM "Figure" WHERE id = ANY($1)
      `, [figIds]);
      console.log(`Esborrades ${deletedFigs.rowCount} Figures d'exemple.`);

      // 6. Compactar
      await pool.query('VACUUM FULL "Figure"');
      await pool.query('VACUUM FULL "Variant"');
      await pool.query('VACUUM FULL "ProductRelease"');
      await pool.query('VACUUM FULL "OwnedFigure"');
      console.log("Taules compactades amb èxit.");
    } else {
      console.log("No s'han trobat figures custom/exemple pendents de neteja.");
    }

    // Comprovació de seguretat d'usuaris
    const usersCount = await pool.query('SELECT count(*) FROM "User"');
    console.log(`Comprovació de seguretat: Hi ha ${usersCount.rows[0].count} usuaris intactes a la base de dades.`);

  } catch (err: any) {
    console.error("Error durant la neteja (possiblement per quota de Neon):", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('cleanFigureCreationExamples.ts')) {
  cleanFigureCreationExamples().catch(err => {
    console.error("Execució finalitzada amb avís:", err.message);
  });
}
