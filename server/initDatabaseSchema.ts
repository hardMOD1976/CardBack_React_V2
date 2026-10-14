import dotenv from 'dotenv';
dotenv.config({ override: true });

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { seedStarWarsCatalogue } from './seedDatabase.js';

const { Pool } = pg;

export async function initDatabaseSchema(customConnectionString?: string) {
  const connectionString = customConnectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("[DB Init] Creating database schema in Neon...");

    // 1. User table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "username" TEXT UNIQUE NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "displayName" TEXT,
        "role" TEXT DEFAULT 'USER',
        "passwordHash" TEXT,
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. PasswordResetToken table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Manufacturer table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Manufacturer" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT,
        "country" TEXT,
        "foundedYear" INTEGER,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Franchise table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Franchise" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 5. Line table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Line" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT,
        "franchiseId" TEXT,
        "manufacturerId" TEXT,
        "startYear" INTEGER,
        "endYear" INTEGER,
        "scale" TEXT,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 6. Character table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Character" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT,
        "franchiseId" TEXT,
        "description" TEXT,
        "image" TEXT,
        "imageUrl" TEXT,
        "affiliation" TEXT,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "image" TEXT;`);
    await pool.query(`ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`);
    await pool.query(`ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "affiliation" TEXT;`);
    await pool.query(`ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;`);

    // 7. Figure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Figure" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "code" TEXT,
        "characterId" TEXT,
        "lineId" TEXT,
        "releaseYear" INTEGER,
        "imageUrl" TEXT,
        "description" TEXT,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 8. Variant table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Variant" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "figureId" TEXT NOT NULL,
        "code" TEXT,
        "imageUrl" TEXT,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 9. ProductRelease table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ProductRelease" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "variantId" TEXT NOT NULL,
        "code" TEXT,
        "releaseYear" INTEGER,
        "packagingType" TEXT,
        "barcode" TEXT,
        "releaseDate" DATE,
        "region" TEXT DEFAULT 'Global',
        "language" TEXT DEFAULT 'English',
        "notes" TEXT,
        "retailer" TEXT,
        "imageUrl" TEXT,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "releaseDate" DATE;`);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "region" TEXT DEFAULT 'Global';`);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'English';`);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "notes" TEXT;`);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "retailer" TEXT;`);
    await pool.query(`ALTER TABLE "ProductRelease" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;`);

    // 10. OwnedFigure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "OwnedFigure" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "productReleaseId" TEXT,
        "condition" TEXT,
        "completeness" TEXT,
        "packagingState" TEXT,
        "purchaseDate" DATE,
        "purchasePrice" NUMERIC(10, 2),
        "currency" VARCHAR(8) DEFAULT 'EUR',
        "purchaseLocation" TEXT,
        "estimatedMarketValue" NUMERIC(10, 2),
        "storageLocation" TEXT,
        "notes" TEXT,
        "quantity" INTEGER DEFAULT 1,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 11. Create or upsert admin user retrofan
    const retrofanHash = await bcrypt.hash("mypassword", 10);
    await pool.query(`
      INSERT INTO "User" (id, username, email, "displayName", role, "passwordHash", "createdAt", "updatedAt")
      VALUES ('user-retrofan', 'retrofan', 'isaacdeferran@gmail.com', 'retrofan', 'ADMIN', $1, NOW(), NOW())
      ON CONFLICT (username) DO UPDATE SET
        role = 'ADMIN',
        "updatedAt" = NOW();
    `, [retrofanHash]);

    console.log("[DB Init] All tables and indexes successfully created.");

    // 12. Seed Star Wars Historical Catalogue
    console.log("[DB Init] Seeding Star Wars Historical Catalogue...");
    const seedResult = await seedStarWarsCatalogue(pool);
    console.log(`[DB Init] Seed complete: ${seedResult.figuresCount} figures, ${seedResult.linesCount} lines, ${seedResult.charactersCount} characters.`);

    return { success: true, ...seedResult };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('initDatabaseSchema.ts')) {
  initDatabaseSchema().then(() => {
    console.log("[DB Init] Finished successfully.");
    process.exit(0);
  }).catch((err) => {
    console.error("[DB Init] Fatal error:", err);
    process.exit(1);
  });
}
