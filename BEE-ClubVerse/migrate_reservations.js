import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { pool, initPostgres } from './db.postgres.js';

dotenv.config();

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, { });
    console.log('Connected to MongoDB');

    await initPostgres();
    console.log('Postgres initialized');

    const mongoColl = mongoose.connection.collection('reservations');
    const docs = await mongoColl.find({}).toArray();
    console.log(`Found ${docs.length} reservation(s) in MongoDB`);

    if (docs.length === 0) {
      console.log('No reservations to migrate. Exiting.');
      await mongoose.disconnect();
      await pool.end();
      return;
    }

    const insertSql = `
      INSERT INTO reservations (
        user_id, name, email, phone, date, time, guests, special_requests, club, club_location, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`;

    let migrated = 0;
    for (const d of docs) {
      const params = [
        d.userId ? String(d.userId) : null,
        d.name || null,
        d.email || null,
        d.phone || null,
        d.date || null,
        d.time || null,
        d.guests || null,
        d.specialRequests || d.special_requests || null,
        d.club || null,
        d.clubLocation || d.club_location || null,
        d.status || 'confirmed',
        d.createdAt ? new Date(d.createdAt) : new Date(),
        d.updatedAt ? new Date(d.updatedAt) : new Date(),
      ];

      try {
        const res = await pool.query(insertSql, params);
        migrated++;
      } catch (err) {
        console.error('Failed to insert reservation', err, params);
      }
    }

    console.log(`Migrated ${migrated}/${docs.length} reservations to PostgreSQL`);
    if (migrated > 0) {
      try {
        await mongoColl.drop();
        console.log('Dropped MongoDB reservations collection');
      } catch (err) {
        console.error('Failed to drop MongoDB reservations collection:', err.message);
      }
    } else {
      console.log('No reservations were migrated; MongoDB collection preserved');
    }

    await mongoose.disconnect();
    await pool.end();

    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    try { await mongoose.disconnect(); } catch (e) {}
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
}

runMigration();
