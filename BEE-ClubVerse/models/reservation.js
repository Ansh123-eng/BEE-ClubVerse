import mongoose from 'mongoose';
import { pool } from '../db.postgres.js';
import User from './user.js';

let usePostgres = false;

(async () => {
  try {
    const res = await pool.query('SELECT 1');
    usePostgres = true;
    console.log('✓ PostgreSQL is available for reservations');
  } catch (err) {
    console.warn('⚠ PostgreSQL unavailable, falling back to MongoDB for reservations:', err.message);
    usePostgres = false;
  }
})().catch(err => {
  console.warn('⚠ Error initializing PostgreSQL check:', err.message);
  usePostgres = false;
});

const reservationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  guests: { type: String, required: true },
  specialRequests: { type: String },
  club: { type: String, required: true },
  clubLocation: { type: String },
  status: { 
    type: String, 
    enum: ['confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reservationSchema.index({ userId: 1, createdAt: -1 });

const MongoReservation = mongoose.model('Reservation', reservationSchema);

function mapRow(row) {
  return {
    _id: row.id?.toString() || null,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    date: row.date,
    time: row.time,
    guests: row.guests,
    specialRequests: row.special_requests,
    club: row.club,
    clubLocation: row.club_location,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ReservationQuery {
  constructor(filter = {}, isPostgres = false) {
    this.filter = filter;
    this._populate = false;
    this._sort = null;
    this.isPostgres = isPostgres;
  }

  populate(fields) { this._populate = fields; return this; }
  sort(sortObj) { this._sort = sortObj; return this; }

  then(resolve, reject) {
    this.exec().then(resolve).catch(reject);
  }

  async exec() {
    if (!this.isPostgres) {
      // Use MongoDB
      let q = MongoReservation.find(this.filter);
      if (this._populate) q = q.populate(this._populate);
      if (this._sort) q = q.sort(this._sort);
      return q;
    }

    // Use PostgreSQL
    const params = [];
    const where = [];
    if (this.filter && this.filter.userId) {
      params.push(String(this.filter.userId));
      where.push(`user_id = $${params.length}`);
    }

    let q = 'SELECT * FROM reservations';
    if (where.length) q += ' WHERE ' + where.join(' AND ');

    if (this._sort) {
      const [k, v] = Object.entries(this._sort)[0];
      const col = k === 'createdAt' ? 'created_at' : k;
      q += ` ORDER BY ${col} ${v === -1 ? 'DESC' : 'ASC'}`;
    }

    const res = await pool.query(q, params);
    const rows = res.rows.map(mapRow);

    if (this._populate) {
      for (const r of rows) {
        try {
          const u = await User.findById(r.userId).select('name email');
          r.userId = u || r.userId;
        } catch (e) {}
      }
    }

    return rows;
  }
}

export default class Reservation {
  constructor(data = {}) {
    this._data = { ...data };
    this._id = data._id || data.id || null;
  }

  async save() {
    if (!usePostgres) {
      // Use MongoDB
      const inst = new MongoReservation(this._data);
      const saved = await inst.save();
      this._data = saved.toObject ? saved.toObject() : saved;
      this._id = saved._id;
      return this;
    }

    // Use PostgreSQL
    if (this._id) {
      const now = new Date();
      const fields = [];
      const params = [];
      const allowed = ['name','email','phone','date','time','guests','specialRequests','club','clubLocation','status'];
      for (const key of allowed) {
        if (this._data[key] !== undefined) {
          params.push(this._data[key]);
          const col = key === 'specialRequests' ? 'special_requests' : (key === 'clubLocation' ? 'club_location' : key);
          fields.push(`${col} = $${params.length}`);
        }
      }
      params.push(now);
      fields.push(`updated_at = $${params.length}`);
      params.push(this._id);
      const sql = `UPDATE reservations SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`;
      const res = await pool.query(sql, params);
      if (res.rows[0]) {
        const mapped = mapRow(res.rows[0]);
        this._data = mapped;
        this._id = mapped._id;
      }
      return this;
    }

    const sql = `INSERT INTO reservations (user_id,name,email,phone,date,time,guests,special_requests,club,club_location,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`;
    const params = [
      this._data.userId ? String(this._data.userId) : null,
      this._data.name,
      this._data.email,
      this._data.phone,
      this._data.date,
      this._data.time,
      this._data.guests,
      this._data.specialRequests || null,
      this._data.club,
      this._data.clubLocation || null,
      this._data.status || 'confirmed',
    ];

    const res = await pool.query(sql, params);
    const mapped = mapRow(res.rows[0]);
    this._data = mapped;
    this._id = mapped._id;
    return this;
  }

  static find(filter = {}) {
    return new ReservationQuery(filter, usePostgres);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    if (!usePostgres) {
      return await MongoReservation.findByIdAndUpdate(id, update, { ...options, new: true });
    }

    const inst = new Reservation({ ...update });
    inst._id = id;
    const updated = await inst.save();
    return updated._data;
  }

  static async findByIdAndDelete(id) {
    if (!usePostgres) {
      return await MongoReservation.findByIdAndDelete(id);
    }

    const sql = 'DELETE FROM reservations WHERE id = $1 RETURNING *';
    const res = await pool.query(sql, [id]);
    if (res.rows[0]) return mapRow(res.rows[0]);
    return null;
  }

  get _id_value() { return this._id; }
}
