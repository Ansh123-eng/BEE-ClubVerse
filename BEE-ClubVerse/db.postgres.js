import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'clubverse',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
});

async function initPostgres() {
  const createSql = `
  CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    guests TEXT NOT NULL,
    special_requests TEXT,
    club TEXT NOT NULL,
    club_location TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
  );
  `;
  await pool.query(createSql);
}

export { pool, initPostgres };
