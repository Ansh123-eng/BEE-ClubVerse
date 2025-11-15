# Quick Reference Guide - New Auth System

## 🚀 Getting Started

### 1. Start Your Server
```bash
cd BEE-ClubVerse
node server.js
```

Server runs at: `http://localhost:8080`

---

## 📋 User Roles & Permissions

### User Role
```
Permissions:
- Create own reservations
- View own reservations
- Update own profile
```

### Manager Role
```
Permissions:
- View all users
- View all reservations
- Manage reservations
- View settings
```

### Admin Role
```
Permissions:
- Everything including:
  - Create/update/delete users
  - Manage all reservations
  - Change user roles
  - Access all admin endpoints
```

---

## 🔑 Authentication Flow

### Step 1: Register New User
```javascript
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}

// Password Requirements:
// - Minimum 8 characters
// - At least 1 uppercase letter (A-Z)
// - At least 1 lowercase letter (a-z)
// - At least 1 number (0-9)
// - At least 1 special character (@$!%*?&)
```

### Step 2: Login
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

// Response:
{
  "message": "Login successful",
  "accessToken": "eyJhbGc...",
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}

// Cookies set automatically:
// - accessToken (httpOnly, 15 minutes)
// - refreshToken (httpOnly, 7 days)
```

### Step 3: Use Access Token
```javascript
// Option 1: Using Authorization Header
GET /api/auth/me
Authorization: Bearer eyJhbGc...

// Option 2: Using Cookies (automatic)
GET /api/auth/me
Cookie: accessToken=eyJhbGc...; refreshToken=...

// Response:
{
  "message": "User profile retrieved",
  "user": { ... }
}
```

### Step 4: Refresh Token When Expired
```javascript
POST /api/auth/refresh-token
// No body needed if using cookies

// Response:
{
  "message": "Token refreshed",
  "accessToken": "eyJhbGc..."
}
```

### Step 5: Logout
```javascript
POST /api/auth/logout
// Requires valid token

// Response:
{
  "message": "Logged out successfully",
  "code": "LOGOUT_SUCCESS"
}

// Cookies cleared automatically
```

---

## 📝 Protected Endpoints

### User Endpoints
```
GET    /api/auth/me              - Get current user profile
PUT    /api/users/:id            - Update own profile
POST   /api/reservations         - Create reservation
GET    /api/reservations/my-bookings - View own reservations
```

### Admin Endpoints
```
GET    /api/admin/users          - View all users
PUT    /api/admin/users/:id/role - Change user role
GET    /api/admin/reservations   - View all reservations
PUT    /api/admin/reservations/:id - Update reservation
DELETE /api/admin/reservations/:id - Delete reservation
```

---

## ⚠️ Error Codes & Status Codes

### Status Codes
```
200 - Success
201 - Created
400 - Bad Request (validation failed)
401 - Unauthorized (need to login/token expired)
403 - Forbidden (insufficient permissions)
404 - Not Found
429 - Rate Limited (too many requests)
500 - Server Error
```

### Error Codes
```
NO_TOKEN              - Missing authentication token
TOKEN_EXPIRED         - Access token expired
INVALID_TOKEN         - Token is invalid/tampered
INVALID_CREDENTIALS   - Wrong email or password
ACCOUNT_LOCKED        - Account locked after failed attempts
RATE_LIMITED          - Too many requests
INSUFFICIENT_PERMISSIONS - User doesn't have required role
NOT_OWNER             - Cannot access other user's resources
WEAK_PASSWORD         - Password doesn't meet requirements
EMAIL_EXISTS          - Email already registered
```

---

## 🔒 Security Features

### Password Hashing
- Algorithm: bcrypt
- Salt rounds: 12 (very secure)
- Never stored in plain text

### Account Lockout
```
Failed Attempt 1-4: Try again
Failed Attempt 5: Account locked for 30 minutes
Successful Login: Counter reset
```

### Token Security
- Access Token: 15 minutes (short-lived)
- Refresh Token: 7 days (long-lived)
- httpOnly: Can't be accessed by JavaScript (prevents XSS)
- secure: Only sent over HTTPS in production
- sameSite: strict (prevents CSRF attacks)

### Rate Limiting
- General: 100 requests per 15 minutes
- Login: 5 attempts per 15 minutes
- Admins: Exempt from rate limits

---

## 🧪 Testing Examples

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "MyPassword123!",
    "confirmPassword": "MyPassword123!"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "jane@example.com",
    "password": "MyPassword123!"
  }'
```

**Get Profile:**
```bash
curl -X GET http://localhost:8080/api/auth/me \
  -b cookies.txt
```

**Create Reservation:**
```bash
curl -X POST http://localhost:8080/api/reservations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "1234567890",
    "date": "2024-12-25",
    "time": "19:00",
    "guests": "4",
    "club": "PAARA - NIGHT CLUB",
    "clubLocation": "Ludhiana",
    "specialRequests": "Window seating"
  }'
```

**Admin: View All Users:**
```bash
curl -X GET http://localhost:8080/api/admin/users \
  -b cookies.txt
# Only works if user has admin role
```

**Refresh Token:**
```bash
curl -X POST http://localhost:8080/api/auth/refresh-token \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:8080/api/auth/logout \
  -b cookies.txt
```

---

## 🐛 Common Issues & Solutions

### "Token expired" error
**Solution:** Call `/api/auth/refresh-token` to get a new access token

### "Insufficient permissions" (403)
**Solution:** Your role doesn't have permission for this endpoint. Contact an admin.

### "Account locked" error
**Solution:** Wait 30 minutes or contact an admin to unlock your account

### "Too many requests" (429)
**Solution:** You've exceeded rate limit. Wait before trying again.
- General: Wait 15 minutes
- Login: Wait 15 minutes (5 attempts limit)

### "Weak password" error
**Solution:** Password must have:
- At least 8 characters
- Uppercase letter (A-Z)
- Lowercase letter (a-z)
- Number (0-9)
- Special character (@$!%*?&)

Example: `SecurePass123!`

### "Email already registered"
**Solution:** Use a different email address or login if account exists

---

## 📊 Authorization Examples

### Protect a route by role:
```javascript
router.get('/admin/dashboard', 
  protect,                    // Require authentication
  authorize('admin'),         // Require admin role
  controller
);
```

### Protect a route by permission:
```javascript
router.get('/manage-users', 
  protect,
  checkPermission(['view_users', 'edit_users']),
  controller
);
```

### Protect a route by ownership:
```javascript
router.put('/profile/:id', 
  protect,
  checkResourceOwnership,     // User can only edit own profile
  controller
);
```

---

## 💾 Default Test Account

For testing, you can create an account with:
```
Name: Test User
Email: test@example.com
Password: TestPass123!
```

---

## 📚 Documentation Files

- `AUTHENTICATION_GUIDE.md` - Deep dive theory
- `AUTHENTICATION_EXAMPLES.js` - Code examples
- `TESTING_GUIDE.js` - Testing scenarios
- `IMPLEMENTATION_SUMMARY.md` - What was implemented

---

**Need help? Check the documentation files or review the middleware in `middlewares/authAdvanced.js`**
