/**
 * AUTHENTICATION & AUTHORIZATION EXAMPLES
 * Real-world scenarios and code patterns
 */

// ============================================
// EXAMPLE 1: Session-Based Authentication
// ============================================

/*
// Installation: npm install express-session connect-mongo

import session from 'express-session';
import MongoStore from 'connect-mongo';

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    mongoUrl: process.env.MONGO_URI
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  resave: false,
  saveUninitialized: false
}));

// Login
router.post('/login', async (req, res) => {
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    req.session.user = user;
    res.redirect('/dashboard');
  }
});

// Middleware to check session
const sessionProtect = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).redirect('/login');
  }
  next();
};

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/');
  });
});
*/

// ============================================
// EXAMPLE 2: OAuth 2.0 / Google Login
// ============================================

/*
// Installation: npm install passport passport-google-oauth20

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos[0].value,
        password: null // OAuth users don't have passwords
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// Routes
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Create JWT
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/dashboard');
  }
);
*/

// ============================================
// EXAMPLE 3: Two-Factor Authentication (2FA)
// ============================================

/*
// Installation: npm install speakeasy qrcode

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// User Schema with 2FA
const userSchema = new Schema({
  email: String,
  password: String,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  backupCodes: [String]
});

// Enable 2FA endpoint
router.post('/auth/2fa/enable', protect, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `ClubVerse (${req.user.email})`,
      issuer: 'ClubVerse'
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      message: 'Scan this QR code with your authenticator app',
      qrCode,
      secret: secret.base32
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Verify 2FA token
router.post('/auth/2fa/verify', protect, async (req, res) => {
  try {
    const { token, secret } = req.body;

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time windows (30 seconds each)
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Save 2FA secret to user
    req.user.twoFactorEnabled = true;
    req.user.twoFactorSecret = secret;
    await req.user.save();

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).json({ error: '2FA verification failed' });
  }
});

// Login with 2FA
router.post('/auth/login-2fa', loginLimiter, async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;

    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.twoFactorEnabled) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 2
      });

      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA token' });
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});
*/

// ============================================
// EXAMPLE 4: JWT with Refresh Token Rotation
// ============================================

/*
const tokenStore = new Map(); // In production, use Redis

router.post('/auth/login', async (req, res) => {
  const user = await authenticate(req.body);

  const accessToken = jwt.sign(
    { id: user._id, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id, type: 'refresh' },
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Store refresh token with metadata
  const tokenId = uuid();
  tokenStore.set(tokenId, {
    token: refreshToken,
    userId: user._id,
    issuedAt: Date.now(),
    rotated: false
  });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 15 * 60
  });
});

router.post('/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    // Find stored token
    const stored = Array.from(tokenStore.values()).find(
      t => t.userId === decoded.id && t.token === refreshToken
    );

    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // New refresh token (rotation)
    const newRefreshToken = jwt.sign(
      { id: decoded.id, type: 'refresh' },
      process.env.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const newAccessToken = jwt.sign(
      { id: decoded.id, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Revoke old token and store new one
    tokenStore.delete(stored.tokenId);
    tokenStore.set(uuid(), {
      token: newRefreshToken,
      userId: decoded.id,
      issuedAt: Date.now(),
      rotated: true
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60
    });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});
*/

// ============================================
// EXAMPLE 5: API Key Authentication
// ============================================

/*
const apiKeySchema = new Schema({
  userId: mongoose.Schema.Types.ObjectId,
  key: { type: String, unique: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  isActive: { type: Boolean, default: true }
});

// Generate API key
router.post('/api-keys', protect, async (req, res) => {
  const apiKey = {
    userId: req.user._id,
    key: require('crypto').randomBytes(32).toString('hex'),
    name: req.body.name,
    expiresAt: req.body.expiresAt
  };

  await APIKey.create(apiKey);
  res.json({ message: 'API key created', apiKey });
});

// Verify API key middleware
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const key = await APIKey.findOne({
    key: apiKey,
    isActive: true,
    expiresAt: { $gt: Date.now() }
  });

  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const user = await User.findById(key.userId);
  req.user = user;
  next();
};

// Usage
router.get('/data', apiKeyAuth, (req, res) => {
  res.json({ data: 'sensitive data' });
});
*/

// ============================================
// EXAMPLE 6: Password Reset Flow
// ============================================

/*
import crypto from 'crypto';

// User schema with reset token
const userSchema = new Schema({
  email: String,
  password: String,
  resetToken: String,
  resetTokenExpires: Date
});

// Request password reset
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetToken = resetTokenHash;
    user.resetTokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send reset link via email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset Link',
      html: `<a href="${resetUrl}">Reset Password</a>`
    });

    res.json({ message: 'Reset link sent to email' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset link' });
  }
});

// Reset password
router.post('/auth/reset-password/:token', async (req, res) => {
  try {
    const resetTokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetToken: resetTokenHash,
      resetTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.password = await bcrypt.hash(req.body.newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});
*/

export { };
