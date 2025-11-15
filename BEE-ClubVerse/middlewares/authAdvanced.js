import jwt from 'jsonwebtoken';
import User from '../models/user.js';

/**
 * Enhanced JWT Protection Middleware
 * Features: Token verification, user lookup, error handling
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // Extract token from Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Not authorized to access this route',
        code: 'NO_TOKEN'
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ 
        error: 'Server misconfiguration',
        code: 'SERVER_ERROR'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    console.error('Auth error:', error.message);
    return res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional Auth Middleware
 * Allows both authenticated and unauthenticated requests
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log('Optional auth failed:', error.message);
  }

  next();
};

/**
 * Role-Based Authorization Middleware
 * Checks if user has required role
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_AUTH'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

/**
 * Permission-Based Authorization Middleware
 * Checks if user has specific permissions
 */
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_AUTH'
      });
    }

    // Define role-permission mapping
    const rolePermissions = {
      admin: [
        'view_users', 'create_users', 'update_users', 'delete_users',
        'view_reservations', 'manage_reservations',
        'view_settings', 'update_settings',
        'view_logs', 'manage_admins'
      ],
      manager: [
        'view_users', 'view_reservations', 'manage_reservations',
        'view_settings'
      ],
      user: [
        'view_profile', 'update_profile',
        'create_reservations', 'view_own_reservations'
      ]
    };

    const userPermissions = rolePermissions[req.user.role] || [];

    const hasPermission = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermissions,
        userPermissions
      });
    }

    next();
  };
};

/**
 * Resource Ownership Middleware
 * Checks if user owns the resource they're trying to access
 */
const checkResourceOwnership = async (req, res, next) => {
  try {
    const resourceId = req.params.id || req.params.userId;
    const requestingUserId = req.user._id.toString();

    // Allow admins to access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    if (resourceId !== requestingUserId) {
      return res.status(403).json({ 
        error: 'Cannot access this resource',
        code: 'NOT_OWNER'
      });
    }

    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    return res.status(500).json({ 
      error: 'Permission check failed',
      code: 'PERMISSION_ERROR'
    });
  }
};

/**
 * Rate Limiting Wrapper
 * Prevents brute force attacks
 */
const createLoginLimiter = (maxAttempts = 5, lockoutTime = 30 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const identifier = req.body.email || req.ip;
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];

    // Remove old attempts outside the lockout window
    const recentAttempts = userAttempts.filter(time => now - time < lockoutTime);

    if (recentAttempts.length >= maxAttempts) {
      const oldestAttempt = Math.min(...recentAttempts);
      const resetTime = new Date(oldestAttempt + lockoutTime);
      
      return res.status(429).json({ 
        error: 'Too many login attempts',
        code: 'RATE_LIMITED',
        resetTime: resetTime.toISOString(),
        retryAfter: Math.ceil((oldestAttempt + lockoutTime - now) / 1000)
      });
    }

    recentAttempts.push(now);
    attempts.set(identifier, recentAttempts);
    next();
  };
};

/**
 * Audit Logging Middleware
 * Logs user actions for security auditing
 */
const auditLog = (action, resource) => {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
      const logEntry = {
        timestamp: new Date(),
        userId: req.user?._id,
        userEmail: req.user?.email,
        action,
        resource,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        statusCode: res.statusCode,
        userAgent: req.get('user-agent')
      };

      console.log('[AUDIT]', JSON.stringify(logEntry));

      res.send = originalSend;
      return originalSend.call(this, data);
    };

    next();
  };
};

export {
  protect,
  optionalAuth,
  authorize,
  checkPermission,
  checkResourceOwnership,
  createLoginLimiter,
  auditLog
};
