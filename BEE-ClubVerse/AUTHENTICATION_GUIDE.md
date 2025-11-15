# Deep Dive: Authentication & Authorization in Express.js

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Authentication Strategies](#authentication-strategies)
3. [Authorization & RBAC](#authorization--rbac)
4. [Security Best Practices](#security-best-practices)
5. [Implementation Examples](#implementation-examples)

---

## Core Concepts

### Authentication vs Authorization
- **Authentication**: Verifying who the user is (Login/Register)
- **Authorization**: Determining what the user can do (Permissions/Roles)

### Token-Based Authentication Flow
```
User Login → Verify Credentials → Generate JWT → Store in Cookie/LocalStorage
              ↓
    Send Token with Request → Middleware Verifies Token → Grant Access
```

---

## Authentication Strategies

### 1. **JWT (JSON Web Token) Authentication**
**What it is**: A stateless token-based authentication method
**Pros**: Scalable, works across microservices, no server-side session storage
**Cons**: Token compromise is harder to revoke, larger payload

**Structure**: `header.payload.signature`
```
{
  "alg": "HS256",      // Algorithm
  "typ": "JWT"
}.
{
  "id": "user_id",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1234567890,   // Issued at
  "exp": 1234571490    // Expiration
}.
HMACSHA256(header + payload + secret)
```

### 2. **Session-Based Authentication**
**What it is**: Server creates a session, sends session ID to client
**Pros**: Easier token revocation, better for traditional apps
**Cons**: Doesn't scale well, requires session storage (DB or Redis)

### 3. **OAuth 2.0 / Social Login**
**What it is**: Delegate authentication to third-party providers (Google, GitHub)
**Pros**: User convenience, reduces password theft
**Cons**: Dependency on external services

---

## Authorization & RBAC

### Role-Based Access Control (RBAC)
Define what actions each role can perform:

```javascript
// Role definitions
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  GUEST: 'guest'
};

// Permission mapping
const PERMISSIONS = {
  admin: ['view_users', 'delete_users', 'edit_settings'],
  manager: ['view_users', 'create_content'],
  user: ['view_profile', 'edit_profile'],
  guest: ['view_public']
};
```

### Middleware for Authorization
```javascript
// Check if user has specific role
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Usage:
app.delete('/api/users/:id', protect, authorize(['admin']), deleteUser);
```

---

## Security Best Practices

### 1. **Password Security**
- ✅ Hash passwords with bcrypt (salt rounds: 10-12)
- ✅ Never store plain text passwords
- ✅ Enforce password strength: min 8 chars, uppercase, number, special char
- ❌ Don't use MD5 or SHA256 alone

### 2. **Token Security**
- ✅ Use HTTPS only (secure flag on cookies)
- ✅ Set httpOnly flag (prevents XSS attacks)
- ✅ Use sameSite=strict to prevent CSRF
- ✅ Keep expiration short (15 min access, 7 days refresh)
- ❌ Don't store secrets in localStorage (vulnerable to XSS)
- ❌ Don't expose tokens in URLs

### 3. **Rate Limiting & Brute Force Protection**
```javascript
// Prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                      // 5 attempts
  message: 'Too many login attempts, try again later'
});

app.post('/api/auth/login', loginLimiter, loginController);
```

### 4. **CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,           // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 5. **Input Validation**
```javascript
// Always validate user input
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
```

---

## Implementation Examples

### Example 1: Basic JWT Flow
```javascript
// Login - Create JWT
const token = jwt.sign(
  { 
    id: user._id, 
    email: user.email,
    role: user.role 
  },
  process.env.JWT_SECRET,
  { expiresIn: '15m' } // Short expiration
);

// Middleware - Verify JWT
const protect = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Example 2: Refresh Token Pattern
```javascript
// Issue both access and refresh tokens
const accessToken = jwt.sign(payload, process.env.JWT_SECRET, 
  { expiresIn: '15m' });
const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, 
  { expiresIn: '7d' });

// Store refresh token in DB
await RefreshToken.create({ 
  token: refreshToken, 
  userId: user._id 
});

// Endpoint to refresh access token
app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  
  const stored = await RefreshToken.findOne({ token: refreshToken });
  if (!stored) return res.status(401).json({ error: 'Invalid token' });
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Token expired' });
  }
});
```

### Example 3: Multi-Level Authorization
```javascript
// Granular permission checking
const authorize = (requiredPermissions) => {
  return async (req, res, next) => {
    const user = await User.findById(req.user.id).populate('role');
    
    const hasPermission = requiredPermissions.every(perm => 
      user.role.permissions.includes(perm)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

// Usage:
app.post('/api/admin/users', 
  protect, 
  authorize(['create_users', 'view_users']), 
  createUserController
);
```

### Example 4: JWT Blacklist for Token Revocation
```javascript
// In-memory or Redis storage
const tokenBlacklist = new Set();

// Add to blacklist on logout
app.post('/api/logout', protect, (req, res) => {
  const token = req.cookies.token;
  tokenBlacklist.add(token);
  
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Check blacklist in middleware
const protect = async (req, res, next) => {
  const token = req.cookies.token;
  
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token revoked' });
  }
  
  // Continue with verification...
};
```

---

## Common Authentication Attacks & Prevention

| Attack | Description | Prevention |
|--------|-------------|-----------|
| **Brute Force** | Trying many password combinations | Rate limiting, account lockout |
| **SQL Injection** | Manipulating queries | Use parameterized queries, ORMs |
| **XSS** | Injecting scripts | Sanitize input, use httpOnly cookies |
| **CSRF** | Forged requests | sameSite cookies, CSRF tokens |
| **Token Theft** | Stealing JWT from localStorage | Use httpOnly cookies, short expiry |
| **Replay Attack** | Reusing old tokens | Add timestamp, check token age |

---

## Summary Checklist

- [ ] Hash passwords with bcrypt
- [ ] Use JWT with short expiration (15-30 min)
- [ ] Implement refresh token pattern
- [ ] Add rate limiting to login endpoint
- [ ] Use httpOnly, secure, sameSite cookies
- [ ] Implement role-based authorization
- [ ] Validate all user input
- [ ] Use HTTPS only
- [ ] Log authentication events
- [ ] Implement token blacklist for logout
- [ ] Add CORS configuration
- [ ] Set secure headers (helmet.js)
- [ ] Implement 2FA for sensitive operations
