import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import {
  protect,
  optionalAuth,
  authorize,
  checkPermission,
  checkResourceOwnership,
  createLoginLimiter,
  auditLog
} from '../middlewares/authAdvanced.js';

const router = express.Router();

// Create login limiter: 5 attempts per 15 minutes
const loginLimiter = createLoginLimiter(5, 15 * 60 * 1000);

/**
 * POST /api/auth/register
 * Public endpoint to register new users
 * 
 * @body {string} name - User's full name
 * @body {string} email - User's email (must be unique)
 * @body {string} password - User's password (min 8 chars)
 * @returns {object} Success message with user data
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'All fields required',
        code: 'MISSING_FIELDS'
      });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be 8+ chars with uppercase, lowercase, number, special char',
        code: 'WEAK_PASSWORD'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password with bcrypt (salt rounds = 12)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user'
    });

    await user.save();

    // Don't return password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'Registration successful! Please login.',
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with email & password
 * Rate limited to prevent brute force
 * 
 * @body {string} email - User's email
 * @body {string} password - User's password
 * @returns {object} JWT token and user data
 */
router.post('/auth/login', loginLimiter, auditLog('LOGIN', 'user'), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        error: 'Account locked. Try again later.',
        code: 'ACCOUNT_LOCKED',
        unlockTime: user.lockUntil
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();

      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Create JWT tokens
    const accessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      {
        id: user._id
      },
      process.env.REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' } // Longer-lived refresh token
    );

    // Set secure cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,        // Prevent XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',    // Prevent CSRF
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Login successful',
      accessToken,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh-token
 * Refresh expired access token using refresh token
 * 
 * @body {string} refreshToken - Valid refresh token
 * @returns {object} New access token
 */
router.post('/auth/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET || process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.json({
      message: 'Token refreshed',
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and clear authentication cookies
 * Protected: Requires authentication
 */
router.post('/auth/logout', protect, auditLog('LOGOUT', 'user'), (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.json({
    message: 'Logged out successfully',
    code: 'LOGOUT_SUCCESS'
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 * Protected: Requires authentication
 */
router.get('/auth/me', protect, (req, res) => {
  const userResponse = req.user.toObject();
  delete userResponse.password;

  res.json({
    message: 'User profile retrieved',
    user: userResponse
  });
});

/**
 * PUT /api/users/:id
 * Update user profile
 * Protected: User can only update their own profile or admin can update anyone
 */
router.put('/users/:id', protect, checkResourceOwnership, auditLog('UPDATE_PROFILE', 'user'), async (req, res) => {
  try {
    const { name, phone } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_FAILED'
    });
  }
});

/**
 * GET /api/admin/users
 * Get all users (Admin only)
 * Protected: Requires admin role
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
      code: 'FETCH_FAILED'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user account (Admin only)
 * Protected: Requires admin role
 */
router.delete('/admin/users/:id', protect, authorize('admin'), checkPermission(['delete_users']), auditLog('DELETE_USER', 'user'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      message: 'User deleted successfully',
      deletedUser: user.email
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      code: 'DELETE_FAILED'
    });
  }
});

export default router;
