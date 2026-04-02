/**
 * Applies migrations/002_gated_users_saved_recipes.sql using the same DB env as server.js.
 * Usage: node scripts/apply-gated-schema.js
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '..', '.env') });

const {
  DB_USER = 'postgres',
  DB_PASSWORD = 'your_password',
  DB_HOST = 'localhost',
  DB_DATABASE = 'platemate'
} = process.env;

const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_DATABASE,
  password: DB_PASSWORD,
  port: 5432
});

const sqlPath = join(__dirname, '..', 'migrations', '002_gated_users_saved_recipes.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await pool.query(sql);
  console.log('Applied:', sqlPath);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
