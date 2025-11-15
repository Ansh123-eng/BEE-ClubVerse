import express from 'express';
import { protect, authorize, checkPermission } from '../middlewares/authAdvanced.js';
import User from '../models/user.js';
import Reservation from '../models/reservation.js';
import transporter from '../middlewares/mailer.js';
import { saveReservationToFile } from '../utils/fileOps.js';

const router = express.Router();

/**
 * POST /api/reservations
 * Create a new table reservation
 * Protected: User must be authenticated
 */
router.post('/reservations', protect, async (req, res) => {
  try {
    const { name, email, phone, date, time, guests, specialRequests, club, clubLocation } = req.body;
    
    // Validation
    if (!name || !email || !phone || !date || !time || !guests || !club) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Create reservation
    const reservation = new Reservation({
      userId: req.user._id,
      name,
      email,
      phone,
      date,
      time,
      guests,
      specialRequests,
      club,
      clubLocation,
      status: 'confirmed'
    });

    await reservation.save();

    // Save to file as backup
    saveReservationToFile({
      userId: req.user._id,
      name,
      email,
      phone,
      date,
      time,
      guests,
      specialRequests,
      club,
      clubLocation,
      createdAt: new Date().toISOString()
    });

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your Table Reservation at ${club}`,
      html: `<h2>Thank you for booking with Club-Verse!</h2>
        <p>Hi ${name},</p>
        <p>Your reservation at <b>${club}</b> is confirmed for <b>${date}</b> at <b>${time}</b> for <b>${guests}</b> guest(s).</p>
        <p>Location: ${clubLocation || ''}</p>
        <p>Special Requests: ${specialRequests || 'None'}</p>
        <p>Reservation ID: ${reservation._id}</p>
        <p>We look forward to hosting you!</p>
        <br><small>This is an automated email. Please do not reply.</small>`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Email send error:', err);
      }
    });

    res.status(201).json({ 
      message: 'Reservation successful! Confirmation email sent.',
      reservation: {
        id: reservation._id,
        club,
        date,
        time,
        guests
      }
    });
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({ 
      error: 'Failed to create reservation',
      code: 'RESERVATION_ERROR'
    });
  }
});

/**
 * GET /api/reservations/my-bookings
 * Get user's own reservations
 * Protected: User must be authenticated
 */
router.get('/reservations/my-bookings', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      message: 'Reservations retrieved',
      count: reservations.length,
      reservations
    });
  } catch (error) {
    console.error('Fetch reservations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reservations',
      code: 'FETCH_ERROR'
    });
  }
});

/**
 * GET /api/admin/reservations
 * Get all reservations (Admin only)
 * Protected: User must be admin
 */
router.get('/admin/reservations', protect, authorize('admin'), checkPermission(['view_reservations']), async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      message: 'All reservations retrieved',
      count: reservations.length,
      reservations
    });
  } catch (error) {
    console.error('Fetch all reservations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reservations',
      code: 'FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/admin/reservations/:id
 * Update reservation status (Admin only)
 * Protected: User must be admin
 */
router.put('/admin/reservations/:id', protect, authorize('admin'), checkPermission(['manage_reservations']), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        code: 'INVALID_STATUS'
      });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ 
        error: 'Reservation not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      message: 'Reservation updated',
      reservation
    });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ 
      error: 'Failed to update reservation',
      code: 'UPDATE_ERROR'
    });
  }
});

/**
 * DELETE /api/admin/reservations/:id
 * Delete reservation (Admin only)
 * Protected: User must be admin
 */
router.delete('/admin/reservations/:id', protect, authorize('admin'), checkPermission(['manage_reservations']), async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);

    if (!reservation) {
      return res.status(404).json({ 
        error: 'Reservation not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      message: 'Reservation deleted',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ 
      error: 'Failed to delete reservation',
      code: 'DELETE_ERROR'
    });
  }
});

/**
 * GET /api/admin/users
 * Get all users (Admin only)
 * Protected: Admin role required
 */
router.get('/admin/users', protect, authorize('admin'), checkPermission(['view_users']), async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.json({
      message: 'Users retrieved',
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      code: 'FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role (Admin only)
 * Protected: Admin role required
 */
router.put('/admin/users/:id/role', protect, authorize('admin'), checkPermission(['update_users']), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin', 'manager'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        code: 'INVALID_ROLE'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, updatedAt: Date.now() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      message: 'User role updated',
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ 
      error: 'Failed to update user',
      code: 'UPDATE_ERROR'
    });
  }
});

export default router;
