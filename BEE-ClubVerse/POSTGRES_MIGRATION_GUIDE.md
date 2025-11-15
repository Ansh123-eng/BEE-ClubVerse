# PostgreSQL Migration Guide for Reservations

## Overview
This project has been updated to support PostgreSQL for storing reservations. The code now implements a **smart fallback mechanism**: if PostgreSQL is unavailable, reservations automatically use MongoDB instead. This ensures the app keeps working while you migrate.

## Current Status
✅ **Server running**: The app is configured to use PostgreSQL for reservations, but currently falls back to MongoDB because PostgreSQL is not accessible.

## What Changed

### 1. **New Files Added**
- `db.postgres.js` — PostgreSQL connection pool and table initialization
- `migrate_reservations.js` — Migration script to copy data from MongoDB to PostgreSQL

### 2. **Modified Files**
- `models/reservation.js` — Now supports both MongoDB and PostgreSQL with automatic fallback
- `.env` — Added PostgreSQL connection variables

### 3. **Dependencies Added**
- `pg` — PostgreSQL client for Node.js

## How It Works

### Fallback Logic
```javascript
let usePostgres = false;

// On startup, tries to connect to PostgreSQL
(async () => {
  try {
    const res = await pool.query('SELECT 1');
    usePostgres = true;
    console.log('✓ PostgreSQL is available for reservations');
  } catch (err) {
    console.warn('⚠ PostgreSQL unavailable, falling back to MongoDB for reservations');
    usePostgres = false;
  }
})();
```

**Behavior:**
- If PostgreSQL is reachable → all reservations are stored in PostgreSQL
- If PostgreSQL is unavailable → all reservations fall back to MongoDB
- No errors; the app keeps working either way

## Setup Instructions (Complete Migration)

### Prerequisites
- PostgreSQL 12+ installed and running locally
- Or Docker installed (to run PostgreSQL in a container)

### Option 1: Local PostgreSQL (if already installed)

1. **Start PostgreSQL** and ensure it's running.

2. **Update `.env`** with your actual PostgreSQL credentials:
   ```env
   PGHOST=localhost
   PGUSER=postgres
   PGPASSWORD=your_real_password
   PGDATABASE=clubverse
   PGPORT=5432
   ```

3. **Run the migration script**:
   ```powershell
   cd 'C:\Users\hp\Desktop\BEE-Final22\BEE-ClubVerse'
   node migrate_reservations.js
   ```

   This script will:
   - Create the `reservations` table in PostgreSQL (if not exists)
   - Copy all existing reservations from MongoDB to PostgreSQL
   - Drop the MongoDB `reservations` collection (only if migration was successful)

4. **Restart the server**:
   ```powershell
   node server.js
   ```

   You should see: `✓ PostgreSQL is available for reservations`

### Option 2: Docker PostgreSQL (Recommended for quick setup)

1. **Install Docker** from [docker.com](https://www.docker.com).

2. **Start PostgreSQL container**:
   ```powershell
   docker run --name clubverse-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=clubverse -p 5432:5432 -d postgres:15
   ```

3. **Verify connection** (wait ~10 seconds for the container to start):
   ```powershell
   psql -h localhost -U postgres -d clubverse -c "SELECT NOW();"
   ```

4. **Run migration**:
   ```powershell
   cd 'C:\Users\hp\Desktop\BEE-Final22\BEE-ClubVerse'
   node migrate_reservations.js
   ```

5. **Restart server**:
   ```powershell
   node server.js
   ```

## Verification

### Check if PostgreSQL is being used
Look at the server startup logs:
- **Success**: `✓ PostgreSQL is available for reservations`
- **Fallback**: `⚠ PostgreSQL unavailable, falling back to MongoDB for reservations`

### Test Reservation Endpoints
1. Log in to the app at `http://localhost:8080`
2. Navigate to the reservation form
3. Submit a reservation
4. If PostgreSQL is active, the data is stored in Postgres; otherwise in MongoDB

### Check PostgreSQL data (after successful migration)
```powershell
psql -h localhost -U postgres -d clubverse -c "SELECT * FROM reservations;"
```

## Rollback (if needed)

If you want to revert to MongoDB-only reservations:

1. **Restore MongoDB collection from backup** (if you backed up before migration).
2. **Edit `models/reservation.js`** and set `usePostgres = false` at the top.

Or simply don't migrate — the fallback logic means the app works fine with MongoDB until you complete the setup.

## Environment Variables

Add these to your `.env` file to connect to PostgreSQL:

```env
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=clubverse
PGPORT=5432
```

All values are optional and have defaults. If left empty, the app uses MongoDB for reservations.

## Troubleshooting

### Error: `password authentication failed for user "postgres"`
- **Cause**: PostgreSQL is either not running or the credentials in `.env` are incorrect.
- **Solution**: 
  - Verify PostgreSQL is running: `psql --version`
  - Check credentials match your local PostgreSQL installation
  - The app will automatically fall back to MongoDB

### Error: `ECONNREFUSED` (connection refused)
- **Cause**: PostgreSQL is not listening on the configured host/port.
- **Solution**:
  - Check PostgreSQL is running: `pg_isready -h localhost -p 5432`
  - Verify `.env` has correct `PGHOST` and `PGPORT`

### Migration script hangs
- **Cause**: Usually waiting for PostgreSQL to start (if using Docker).
- **Solution**: Wait 10-15 seconds after starting the Docker container and retry.

## File Structure

```
BEE-ClubVerse/
├── db.postgres.js              ← New: PostgreSQL connection
├── migrate_reservations.js      ← New: Migration script
├── models/
│   ├── reservation.js           ← Modified: Smart MongoDB/Postgres fallback
│   └── user.js
├── .env                         ← Modified: Added PG* variables
└── ... (rest of files)
```

## Next Steps

1. Set up PostgreSQL (local or Docker)
2. Update `.env` with real credentials
3. Run `node migrate_reservations.js`
4. Verify `✓ PostgreSQL is available` in server logs
5. Test the reservation endpoints in the web app

Once PostgreSQL is running and accessible, the app will automatically switch from MongoDB to PostgreSQL for all reservation operations.

## Questions?

- **MongoDB and PostgreSQL both running?** Yes! Users stay in MongoDB, only reservations move to PostgreSQL.
- **Can I still use MongoDB for reservations?** Yes! The app falls back automatically if PostgreSQL is unavailable.
- **Will the app break if I don't migrate?** No. The fallback mechanism ensures the app keeps working with MongoDB.
- **Can I test this locally first?** Yes. Run `docker run ...` to start PostgreSQL in a container, then run the migration.

---

**Status**: ✅ Ready for PostgreSQL. Currently using MongoDB as fallback.
