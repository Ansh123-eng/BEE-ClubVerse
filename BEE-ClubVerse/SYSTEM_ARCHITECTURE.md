# System Architecture - ClubVerse Authentication & Authorization

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  - Registration Form                                         │
│  - Login Form                                               │
│  - Protected Pages (Dashboard, Reservations)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP/HTTPS
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   EXPRESS SERVER                             │
│                 (localhost:8080)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE STACK                        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 1. Morgan (Logging)                                  │   │
│  │ 2. Helmet (Security Headers)                         │   │
│  │ 3. CORS (Cross-Origin)                               │   │
│  │ 4. Cookie Parser                                     │   │
│  │ 5. Express JSON/URL Parser                           │   │
│  │ 6. Rate Limiter (100 req/15 min)                    │   │
│  │ 7. Custom Logger (Winston)                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           ROUTE HANDLERS                            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  PUBLIC ROUTES                              │   │   │
│  │  │  - POST /api/auth/register                  │   │   │
│  │  │  - POST /api/auth/login (rate limited)     │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                      │                              │   │
│  │                 protect()                           │   │
│  │         (Verify JWT Token)                         │   │
│  │                      │                              │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  PROTECTED ROUTES                           │   │   │
│  │  │  - POST /api/auth/logout                    │   │   │
│  │  │  - GET  /api/auth/me                        │   │   │
│  │  │  - POST /api/reservations                   │   │   │
│  │  │  - GET  /api/reservations/my-bookings       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                      │                              │   │
│  │       authorize('admin') / checkPermission()        │   │
│  │                      │                              │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  ADMIN ROUTES                               │   │   │
│  │  │  - GET  /api/admin/users                    │   │   │
│  │  │  - PUT  /api/admin/users/:id/role           │   │   │
│  │  │  - GET  /api/admin/reservations             │   │   │
│  │  │  - PUT  /api/admin/reservations/:id         │   │   │
│  │  │  - DELETE /api/admin/reservations/:id       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │        ERROR HANDLER                                │   │
│  │  - Validation Errors (400)                          │   │
│  │  - Authentication Errors (401)                      │   │
│  │  - Authorization Errors (403)                       │   │
│  │  - Not Found (404)                                  │   │
│  │  - Rate Limit (429)                                 │   │
│  │  - Server Errors (500)                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                  │
         │                                  │
    HTTP Response                      Database
    (JSON/Render)                      Operations
         │                                  │
         └──────────────┬───────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│              MONGODB DATABASE                     │
├────────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │  Users Collection                        │   │
│  │  - _id                                   │   │
│  │  - name, email, password (hashed)        │   │
│  │  - role (user/admin/manager)            │   │
│  │  - loginAttempts, lockUntil             │   │
│  │  - lastLogin, isActive                   │   │
│  │  - createdAt, updatedAt                  │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │  Reservations Collection                 │   │
│  │  - _id                                   │   │
│  │  - userId (ref to User)                  │   │
│  │  - name, email, phone                    │   │
│  │  - date, time, guests                    │   │
│  │  - club, clubLocation                    │   │
│  │  - status (confirmed/cancelled)          │   │
│  │  - createdAt, updatedAt                  │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
└────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│  REGISTRATION FLOW                                      │
└─────────────────────────────────────────────────────────┘

1. User fills registration form
   │
   ├─→ POST /api/auth/register
   │   {name, email, password, confirmPassword}
   │
   ├─→ Validate input
   │   ✓ All fields required
   │   ✓ Password strength (8+ chars, upper, lower, num, special)
   │   ✓ Passwords match
   │   ✓ Email not already registered
   │
   ├─→ Hash password (bcrypt, salt rounds: 12)
   │
   ├─→ Create user in database
   │   {name, email, hashedPassword, role: 'user'}
   │
   └─→ Return success message + redirect to login


┌─────────────────────────────────────────────────────────┐
│  LOGIN FLOW                                             │
└─────────────────────────────────────────────────────────┘

1. User enters email and password
   │
   ├─→ POST /api/auth/login (Rate Limited: 5/15 min)
   │   {email, password}
   │
   ├─→ Find user in database
   │   ✓ User exists?
   │   ✓ Account not locked?
   │
   ├─→ Compare password with hash (bcrypt)
   │
   ├─→ On success:
   │   ├─→ Reset login attempts to 0
   │   ├─→ Update last login timestamp
   │   ├─→ Generate accessToken (JWT, 15 min)
   │   ├─→ Generate refreshToken (JWT, 7 days)
   │   ├─→ Store tokens in httpOnly cookies
   │   └─→ Return tokens + user data
   │
   └─→ On failure:
       ├─→ Increment login attempts
       ├─→ If attempts >= 5:
       │   └─→ Lock account for 30 minutes
       └─→ Return 401 Unauthorized


┌─────────────────────────────────────────────────────────┐
│  PROTECTED REQUEST FLOW                                 │
└─────────────────────────────────────────────────────────┘

1. Client sends request with token
   │
   ├─→ GET /api/auth/me
   │   Authorization: Bearer accessToken
   │   OR Cookie: accessToken=...
   │
   ├─→ protect() middleware
   │   ├─→ Extract token from header or cookie
   │   ├─→ Verify token signature
   │   ├─→ Check token not expired
   │   ├─→ Look up user in database
   │   └─→ Verify user is active
   │
   ├─→ Attach user to request (req.user)
   │
   └─→ Route handler executes


┌─────────────────────────────────────────────────────────┐
│  AUTHORIZATION FLOW (Admin Route)                       │
└─────────────────────────────────────────────────────────┘

1. protect() → User verified
   │
   ├─→ authorize('admin') middleware
   │   ├─→ Check req.user.role
   │   ├─→ Is user.role in ['admin']?
   │   │   YES → Continue
   │   │   NO → Return 403 Forbidden
   │
   ├─→ checkPermission(['view_users']) middleware
   │   ├─→ Get user permissions by role
   │   ├─→ Check if ['view_users'] in permissions
   │   │   YES → Continue
   │   │   NO → Return 403 Forbidden
   │
   └─→ Route handler executes


┌─────────────────────────────────────────────────────────┐
│  TOKEN REFRESH FLOW                                     │
└─────────────────────────────────────────────────────────┘

1. Access token expired (401)
   │
   ├─→ POST /api/auth/refresh-token
   │   Cookie: refreshToken=...
   │
   ├─→ Extract refresh token from cookie
   │
   ├─→ Verify refresh token
   │   ✓ Signature valid?
   │   ✓ Not expired?
   │
   ├─→ Look up user
   │   ✓ User exists?
   │   ✓ User active?
   │
   ├─→ Generate new access token (15 min)
   │
   └─→ Return new access token


┌─────────────────────────────────────────────────────────┐
│  ACCOUNT LOCKOUT FLOW                                   │
└─────────────────────────────────────────────────────────┘

Attempt 1: loginAttempts = 1
Attempt 2: loginAttempts = 2
Attempt 3: loginAttempts = 3
Attempt 4: loginAttempts = 4
Attempt 5: loginAttempts = 5, lockUntil = now + 30 min
           ↓
           isLocked = true
Attempt 6: "Account locked"
           Wait 30 minutes...
           lockUntil < now → isLocked = false
           Can login again


┌─────────────────────────────────────────────────────────┐
│  LOGOUT FLOW                                            │
└─────────────────────────────────────────────────────────┘

1. User clicks logout
   │
   ├─→ POST /api/auth/logout
   │   (with valid access token)
   │
   ├─→ protect() middleware → user verified
   │
   ├─→ Clear authentication cookies
   │   - accessToken deleted
   │   - refreshToken deleted
   │
   └─→ Return success message
       (Tokens become invalid)
```

---

## 🗂️ File Structure

```
BEE-ClubVerse/
├── models/
│   ├── user.js              ← Updated with role, lockout
│   └── reservation.js       ← Updated with userId, status
│
├── middlewares/
│   ├── auth.js              ← Original (basic protect)
│   ├── authAdvanced.js      ← NEW (7 auth middlewares)
│   ├── errorHandler.js
│   ├── logger.js
│   └── mailer.js
│
├── routes/
│   └── authRoutes.js        ← NEW (auth system)
│
├── api/
│   └── apiRoutes.js         ← Updated with auth
│
├── public/
├── views/
│
├── server.js                ← Updated with auth routes
├── .env                     ← Updated with JWT secrets
│
├── Documentation/
├── AUTHENTICATION_GUIDE.md      ← Theory & concepts
├── AUTHENTICATION_EXAMPLES.js   ← Code patterns
├── TESTING_GUIDE.js             ← Testing scenarios
├── IMPLEMENTATION_SUMMARY.md    ← What was implemented
├── QUICK_START.md               ← Quick reference
└── README_AUTH.md               ← This guide
```

---

## 🔑 Middleware Dependency Chain

```
┌─────────────────────────────────────┐
│  PUBLIC ENDPOINTS                   │
│  /api/auth/register                 │
│  /api/auth/login                    │
│  No middleware required              │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│  PROTECTED ENDPOINTS                │
│  /api/auth/me                       │
│  /api/reservations                  │
│         │                           │
│         ├─→ protect()               │
│         │   (Verify JWT)            │
│         │                           │
│         └─→ Route handler           │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│  ROLE-PROTECTED ENDPOINTS           │
│  /api/admin/users                   │
│  /api/admin/reservations            │
│         │                           │
│         ├─→ protect()               │
│         │   (Verify JWT)            │
│         │                           │
│         ├─→ authorize('admin')      │
│         │   (Check role)            │
│         │                           │
│         └─→ Route handler           │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│  PERMISSION-PROTECTED ENDPOINTS     │
│  /api/admin/users/:id/role          │
│         │                           │
│         ├─→ protect()               │
│         │   (Verify JWT)            │
│         │                           │
│         ├─→ authorize('admin')      │
│         │   (Check role)            │
│         │                           │
│         ├─→ checkPermission()       │
│         │   (Check permissions)     │
│         │                           │
│         └─→ Route handler           │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│  OWNERSHIP-PROTECTED ENDPOINTS      │
│  PUT /api/users/:id                 │
│         │                           │
│         ├─→ protect()               │
│         │   (Verify JWT)            │
│         │                           │
│         ├─→ checkResourceOwnership()│
│         │   (Verify ownership)      │
│         │                           │
│         └─→ Route handler           │
└─────────────────────────────────────┘
```

---

## 🔢 Data Flow Example: User Makes Reservation

```
STEP 1: Login
─────────────────────────────────────
User submits: {email, password}
    ↓
Server verifies in database
    ↓
Server issues: accessToken (15 min) + refreshToken (7 days)
    ↓
Client stores in httpOnly cookies


STEP 2: Make Reservation
─────────────────────────────────────
Client requests: POST /api/reservations
Authorization: Bearer [accessToken]
Body: {name, email, phone, date, time, guests, club...}
    ↓
Express parses request
    ↓
protect() middleware
    ├─→ Extracts accessToken
    ├─→ Verifies signature (using JWT_SECRET)
    ├─→ Checks expiration
    ├─→ Looks up User in database
    ├─→ Verifies isActive = true
    └─→ Attaches user to req (req.user)
    ↓
Route handler executes
    ├─→ Validates input
    ├─→ Creates Reservation record with userId
    ├─→ Saves to database
    ├─→ Sends confirmation email
    └─→ Returns success response
    ↓
Client receives: {message, reservation}


STEP 3: Access Expired
─────────────────────────────────────
Client tries new request with expired accessToken
    ↓
protect() middleware fails: "Token expired" (401)
    ↓
Client calls: POST /api/auth/refresh-token
Cookie: refreshToken=...
    ↓
Server verifies refreshToken
    ↓
Server generates new accessToken (15 min)
    ↓
Client retries original request with new accessToken
    ↓
Request succeeds


STEP 4: Logout
─────────────────────────────────────
Client calls: POST /api/auth/logout
Authorization: Bearer [accessToken]
    ↓
protect() verifies token
    ↓
Server clears cookies
    ↓
Tokens become invalid
    ↓
Any future request without valid token → 401
```

---

## 📊 Token Structure

### Access Token (JWT)
```javascript
{
  "alg": "HS256",
  "typ": "JWT"
}.{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "user",
  "iat": 1700076000,  // Issued at
  "exp": 1700076900   // Expires in 15 minutes
}.HMACSHA256(secret)
```

### Refresh Token (JWT)
```javascript
{
  "alg": "HS256",
  "typ": "JWT"
}.{
  "id": "507f1f77bcf86cd799439011",
  "iat": 1700076000,  // Issued at
  "exp": 1700680800   // Expires in 7 days
}.HMACSHA256(refresh_secret)
```

### Cookie Settings
```
accessToken:
  - httpOnly: true        (JS can't access)
  - secure: true          (HTTPS only in production)
  - sameSite: strict      (CSRF protection)
  - maxAge: 900000 ms     (15 minutes)
  - path: /

refreshToken:
  - httpOnly: true        (JS can't access)
  - secure: true          (HTTPS only in production)
  - sameSite: strict      (CSRF protection)
  - maxAge: 604800000 ms  (7 days)
  - path: /
```

---

## 🎯 Security Benefits

```
┌──────────────────────────────────────┐
│  bcrypt Password Hashing             │
├──────────────────────────────────────┤
│ ✓ Salted (random bytes added)        │
│ ✓ 12 rounds (computationally hard)   │
│ ✓ Different hash each time           │
│ ✓ Collision resistant                │
│ → Even if DB is breached, passwords  │
│   cannot be reversed                 │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  JWT Token Security                  │
├──────────────────────────────────────┤
│ ✓ Signature verification             │
│ ✓ Expiration checking                │
│ ✓ httpOnly cookies (XSS protection)  │
│ ✓ Secure flag (HTTPS only)           │
│ ✓ sameSite=strict (CSRF protection)  │
│ → Tokens cannot be stolen or forged  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Account Lockout Protection          │
├──────────────────────────────────────┤
│ ✓ Tracks failed attempts             │
│ ✓ Locks after 5 failures             │
│ ✓ 30-minute lockout                  │
│ ✓ Automatic unlock                   │
│ → Prevents brute force attacks       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Rate Limiting Protection            │
├──────────────────────────────────────┤
│ ✓ 5 login attempts per 15 minutes    │
│ ✓ 100 general requests per 15 min    │
│ ✓ IP-based enforcement               │
│ ✓ Admin exemption                    │
│ → Prevents DoS and spam attacks      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Authorization & Access Control      │
├──────────────────────────────────────┤
│ ✓ Role-based access control          │
│ ✓ Permission-based authorization     │
│ ✓ Resource ownership verification    │
│ → Only authorized users can access   │
│   resources they should have access  │
└──────────────────────────────────────┘
```

---

This architecture provides a complete, secure, and scalable authentication and authorization system for your ClubVerse application!
