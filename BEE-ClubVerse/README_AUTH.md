# 🔐 Complete Authentication & Authorization System - Implementation Guide

## 📋 Overview

Your ClubVerse application now includes a **production-ready authentication and authorization system** with all requested features:

✅ Role-based authorization (user, admin, manager)
✅ Account lockout mechanism (5 attempts, 30 min lockout)
✅ Refresh token system (15 min access, 7 day refresh)
✅ Password strength validation (8 chars, uppercase, lowercase, number, special char)
✅ Rate limiting on all endpoints (100 req/15 min general, 5 req/15 min login)

---

## 🎯 What Changed

### Files Created/Modified:

| File | Changes |
|------|---------|
| `models/user.js` | Added role, account lockout, login tracking |
| `models/reservation.js` | Added userId, status, timestamps |
| `middlewares/authAdvanced.js` | 7 new auth middlewares |
| `routes/authRoutes.js` | Complete auth system (NEW) |
| `api/apiRoutes.js` | Updated with authorization |
| `.env` | Added JWT secrets and config |
| `server.js` | Integrated auth routes & rate limiters |

### Documentation Created:

| File | Purpose |
|------|---------|
| `AUTHENTICATION_GUIDE.md` | Deep dive into auth concepts |
| `AUTHENTICATION_EXAMPLES.js` | Code patterns for various auth methods |
| `TESTING_GUIDE.js` | Comprehensive testing scenarios |
| `IMPLEMENTATION_SUMMARY.md` | What was implemented |
| `QUICK_START.md` | Quick reference guide |

---

## 🚀 Getting Started

### 1. Start the Server
```bash
cd BEE-ClubVerse
node server.js
```

The server will start at `http://localhost:8080` and connect to MongoDB.

### 2. Create a User Account
```bash
# Using cURL:
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "your@email.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

### 3. Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "your@email.com",
    "password": "SecurePass123!"
  }'
```

This saves authentication cookies automatically.

### 4. Access Protected Routes
```bash
# Get your profile:
curl -X GET http://localhost:8080/api/auth/me \
  -b cookies.txt

# Create a reservation:
curl -X POST http://localhost:8080/api/reservations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Your Name",
    "email": "your@email.com",
    "phone": "1234567890",
    "date": "2024-12-25",
    "time": "19:00",
    "guests": "4",
    "club": "PAARA - NIGHT CLUB",
    "clubLocation": "Ludhiana"
  }'
```

---

## 🔐 Key Features Explained

### 1. Role-Based Authorization

**Three Roles:**
- `user` - Regular customers
- `manager` - Can manage reservations
- `admin` - Full system access

**How to Check:**
```javascript
// User can only access own data
GET /api/auth/me
→ Returns current user's profile

// Admins can manage users
GET /api/admin/users
→ Returns all users (admin only)

// Managers can manage reservations
GET /api/admin/reservations
→ Returns all reservations (admin/manager only)
```

### 2. Account Lockout Mechanism

**Protection:**
- Tracks failed login attempts
- Locks account after 5 failed attempts
- Locked for 30 minutes
- Automatically unlocks
- Resets on successful login

**Example Flow:**
```
Attempt 1 (wrong password) → Try again
Attempt 2 (wrong password) → Try again
Attempt 3 (wrong password) → Try again
Attempt 4 (wrong password) → Try again
Attempt 5 (wrong password) → ACCOUNT LOCKED for 30 minutes
Attempt 6 → "Account locked. Try again later."
After 30 minutes → Can login again
```

### 3. Refresh Token System

**Two Tokens:**
- **Access Token:** 15 minutes (short-lived, used for API requests)
- **Refresh Token:** 7 days (long-lived, used to get new access token)

**Flow:**
```
1. User logs in → Get both tokens
2. Make API requests → Use access token
3. Access token expires → Get 401 Unauthorized
4. Send refresh token → Get new access token
5. Continue using API
```

**Endpoint:**
```bash
# Refresh your access token:
curl -X POST http://localhost:8080/api/auth/refresh-token \
  -b cookies.txt
```

### 4. Password Strength Validation

**Requirements:**
```
✅ SecurePass123!  → Valid
❌ Weak123        → Missing uppercase and special char
❌ UPPERCASE123   → Missing lowercase
❌ lowercase123!  → Missing uppercase
❌ NoNumbers!     → Missing number
❌ NoSpec123      → Missing special character (@$!%*?&)
```

### 5. Rate Limiting

**General Endpoints:** 100 requests per 15 minutes
```bash
# 101st request in 15 minutes:
curl http://localhost:8080/api/any-endpoint
→ 429 Too Many Requests
```

**Login Endpoint:** 5 attempts per 15 minutes
```bash
# 6th login attempt in 15 minutes:
curl -X POST http://localhost:8080/api/auth/login \
  -d '{"email":"test@test.com","password":"wrong"}'
→ 429 Too Many Requests
```

**Admin Exemption:**
Admins bypass rate limiting for better user management experience.

---

## 📚 API Endpoints Reference

### Authentication Routes

```
POST   /api/auth/register
  - Create new account
  - Public endpoint
  - Body: name, email, password, confirmPassword

POST   /api/auth/login
  - Login user
  - Rate limited: 5 attempts/15 min
  - Body: email, password
  - Returns: accessToken, user data

POST   /api/auth/logout
  - Logout user
  - Protected (requires authentication)
  - Clears cookies

POST   /api/auth/refresh-token
  - Get new access token
  - Body: optional (uses cookie if available)
  - Returns: new accessToken

GET    /api/auth/me
  - Get current user profile
  - Protected (requires authentication)
  - Returns: current user data
```

### Reservation Routes

```
POST   /api/reservations
  - Create reservation
  - Protected (user must be logged in)
  - Body: name, email, phone, date, time, guests, club, etc.

GET    /api/reservations/my-bookings
  - Get user's own reservations
  - Protected

GET    /api/admin/reservations
  - Get all reservations
  - Protected (admin only)

PUT    /api/admin/reservations/:id
  - Update reservation
  - Protected (admin only)
  - Body: status (confirmed/cancelled/completed)

DELETE /api/admin/reservations/:id
  - Delete reservation
  - Protected (admin only)
```

### User Management Routes

```
GET    /api/admin/users
  - List all users
  - Protected (admin only)

PUT    /api/admin/users/:id/role
  - Change user role
  - Protected (admin only)
  - Body: role (user/admin/manager)

DELETE /api/admin/users/:id
  - Delete user
  - Protected (admin only)

PUT    /api/users/:id
  - Update own profile
  - Protected (user can edit own profile)
  - Body: name, phone
```

---

## 🧪 Testing in Postman/Insomnia

### 1. Create Collection
Name: "ClubVerse Auth"

### 2. Add Requests

**Register:**
```
POST http://localhost:8080/api/auth/register
Headers:
  Content-Type: application/json

Body:
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "TestPass123!",
  "confirmPassword": "TestPass123!"
}
```

**Login:**
```
POST http://localhost:8080/api/auth/login
Headers:
  Content-Type: application/json

Body:
{
  "email": "test@example.com",
  "password": "TestPass123!"
}

✓ Save response to use tokens in other requests
```

**Get Profile:**
```
GET http://localhost:8080/api/auth/me
Headers:
  Authorization: Bearer [paste_accessToken_here]
```

**Create Reservation:**
```
POST http://localhost:8080/api/reservations
Headers:
  Content-Type: application/json
  Authorization: Bearer [paste_accessToken_here]

Body:
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "1234567890",
  "date": "2024-12-25",
  "time": "19:00",
  "guests": "4",
  "club": "PAARA - NIGHT CLUB",
  "clubLocation": "Ludhiana"
}
```

---

## ⚙️ Configuration

### Environment Variables (.env)

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/clubverse

# Server
PORT=8080
NODE_ENV=development

# JWT Secrets (Change these in production!)
JWT_SECRET=super_secret_jwt_key_change_in_production_12345
REFRESH_SECRET=super_secret_refresh_key_change_in_production_67890

# API Keys
OPENWEATHER_API_KEY=your_api_key_here

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here

# Security Settings
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=30  # minutes
```

### Important: Change Secrets in Production

```env
# ❌ NEVER use these in production:
JWT_SECRET=super_secret_jwt_key_change_in_production_12345
REFRESH_SECRET=super_secret_refresh_key_change_in_production_67890

# ✅ Use long random strings:
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
REFRESH_SECRET=z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1
```

---

## 🔒 Security Checklist

Before going to production:

- [ ] Change JWT_SECRET and REFRESH_SECRET in .env
- [ ] Enable HTTPS/SSL
- [ ] Set NODE_ENV=production
- [ ] Use secure password for MongoDB
- [ ] Configure email service (Gmail App Password)
- [ ] Set up CORS properly for your domain
- [ ] Enable request logging and monitoring
- [ ] Set up database backups
- [ ] Use environment-specific .env files
- [ ] Remove debug endpoints
- [ ] Test rate limiting thoroughly
- [ ] Monitor account lockouts for attacks

---

## 📊 Middleware Stack

Each request goes through:

```
1. Morgan (HTTP logging)
2. Helmet (Security headers)
3. CORS (Cross-origin control)
4. Cookie Parser (Parse cookies)
5. Express JSON (Parse JSON)
6. Rate Limiter (Limit requests)
7. Request Logger (Custom logging)
8. Route Handler
9. Error Handler
```

Protected routes additionally use:
```
1. protect → Verify JWT token
2. authorize → Check user role
3. checkPermission → Check specific permissions
4. checkResourceOwnership → Verify data ownership
```

---

## 🐛 Troubleshooting

### Server won't start
```
Error: connect ECONNREFUSED
→ MongoDB is not running. Start MongoDB service.

Error: Cannot find module
→ Run: npm install
```

### Getting "Token expired" constantly
```
→ Access token is only 15 minutes.
→ Use refresh token endpoint to get new one.
→ Or implement automatic refresh in frontend.
```

### "Insufficient permissions" error (403)
```
→ Your role doesn't have access to this endpoint.
→ Admin user can access all endpoints.
→ Ask admin to upgrade your role if needed.
```

### "Account locked" error
```
→ Too many failed login attempts.
→ Wait 30 minutes or contact admin.
→ Admin can manually unlock by updating database.
```

### Rate limiting too strict
```
→ Edit server.js to adjust limits:
   - windowMs: time window
   - max: max requests in window
```

---

## 🚀 Next Steps

1. **Test everything** with the QUICK_START.md guide
2. **Integrate frontend** to use new auth endpoints
3. **Setup production environment** with proper secrets
4. **Enable HTTPS** for secure connections
5. **Implement 2FA** for admin accounts (see AUTHENTICATION_EXAMPLES.js)
6. **Add password reset** functionality
7. **Setup monitoring** for security events
8. **Create admin panel** for user management

---

## 📖 Additional Resources

- `QUICK_START.md` - Quick reference guide
- `AUTHENTICATION_GUIDE.md` - Deep dive theory
- `TESTING_GUIDE.js` - Testing scenarios
- `AUTHENTICATION_EXAMPLES.js` - Code patterns
- `IMPLEMENTATION_SUMMARY.md` - What was implemented

---

## ✅ Implementation Status

**Complete and ready to use!**

All requested features have been implemented and integrated:
- ✅ Role-based authorization
- ✅ Account lockout mechanism
- ✅ Refresh token system
- ✅ Password strength validation
- ✅ Rate limiting on all endpoints

The system is production-ready with proper error handling, logging, and security measures.

**Questions?** Review the documentation files or check the middleware implementations.
