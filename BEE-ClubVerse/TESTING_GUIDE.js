/**
 * TESTING AUTHENTICATION & AUTHORIZATION
 * 
 * Use this guide with tools like Postman, Insomnia, or cURL
 * to test all authentication and authorization flows
 */

// ============================================
// 1. TESTING USER REGISTRATION
// ============================================

/*
POST http://localhost:8080/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}

// Expected Response (201):
{
  "message": "Registration successful! Please login.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2024-11-15T10:30:00Z"
  }
}

// Test Cases:
✓ Valid registration with strong password
✓ Weak password (no uppercase/special char) → 400
✓ Password mismatch → 400
✓ Duplicate email → 409
✓ Missing fields → 400
*/

// ============================================
// 2. TESTING USER LOGIN
// ============================================

/*
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

// Expected Response (200):
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "lastLogin": "2024-11-15T10:35:00Z"
  }
}

// Cookies Set:
- accessToken (httpOnly, secure, 15 min)
- refreshToken (httpOnly, secure, 7 days)

// Test Cases:
✓ Correct credentials → 200
✓ Wrong password → 401
✓ User not found → 401
✓ Account locked (5 failed attempts) → 403
✓ Missing credentials → 400
✓ Rate limited (6th attempt in 15 min) → 429
*/

// ============================================
// 3. TESTING TOKEN REFRESH
// ============================================

/*
POST http://localhost:8080/api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// OR (with cookie):
POST http://localhost:8080/api/auth/refresh-token
Content-Type: application/json
Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Expected Response (200):
{
  "message": "Token refreshed",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Test Cases:
✓ Valid refresh token → 200
✓ Expired refresh token → 401
✓ Invalid token → 401
✓ Missing token → 401
✓ User account disabled → 401
*/

// ============================================
// 4. TESTING PROTECTED ENDPOINTS
// ============================================

/*
GET http://localhost:8080/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// OR (with cookie):
GET http://localhost:8080/api/auth/me
Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Expected Response (200):
{
  "message": "User profile retrieved",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "phone": "+1234567890"
  }
}

// Test Cases:
✓ Valid token → 200
✓ Expired token → 401
✓ Invalid token → 401
✓ No token → 401
✓ Disabled account → 403
*/

// ============================================
// 5. TESTING ROLE-BASED AUTHORIZATION
// ============================================

/*
GET http://localhost:8080/api/admin/users
Authorization: Bearer [admin_token]

// Expected Response (200) - Admin:
{
  "message": "Users retrieved",
  "count": 10,
  "users": [...]
}

// Expected Response (403) - Regular User:
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN",
  "userRole": "user",
  "requiredRoles": ["admin"]
}

// Test Cases:
✓ Admin accessing admin endpoint → 200
✓ User accessing admin endpoint → 403
✓ Manager accessing user endpoint → 200
✓ Disabled user accessing any endpoint → 403
*/

// ============================================
// 6. TESTING RESOURCE OWNERSHIP
// ============================================

/*
// User 1 token
PUT http://localhost:8080/api/users/user1_id
Authorization: Bearer [user1_token]
Content-Type: application/json

{
  "phone": "+1234567890"
}

// Expected Response (200):
{
  "message": "Profile updated successfully",
  "user": { ... }
}

// User 2 trying to update User 1's profile
PUT http://localhost:8080/api/users/user1_id
Authorization: Bearer [user2_token]
Content-Type: application/json

{
  "phone": "+9876543210"
}

// Expected Response (403):
{
  "error": "Cannot access this resource",
  "code": "NOT_OWNER"
}

// BUT: Admin can update anyone's profile
PUT http://localhost:8080/api/users/user1_id
Authorization: Bearer [admin_token]

// Expected Response (200):
{
  "message": "Profile updated successfully",
  "user": { ... }
}

// Test Cases:
✓ Own profile → 200
✓ Other user's profile (non-admin) → 403
✓ Other user's profile (admin) → 200
✓ Deleted user ID → 404
*/

// ============================================
// 7. TESTING LOGOUT
// ============================================

/*
POST http://localhost:8080/api/auth/logout
Authorization: Bearer [token]

// Expected Response (200):
{
  "message": "Logged out successfully",
  "code": "LOGOUT_SUCCESS"
}

// Cookies Cleared:
- accessToken deleted
- refreshToken deleted

// Test Cases:
✓ Valid token → 200, cookies cleared
✓ Invalid token → 401
✓ No token → 401
*/

// ============================================
// 8. TESTING RATE LIMITING
// ============================================

/*
// Attempt 1-5: Success
POST http://localhost:8080/api/auth/login
{ "email": "john@example.com", "password": "wrong" }
→ 401 Unauthorized (attempt counted)

// Attempt 6 within 15 minutes:
POST http://localhost:8080/api/auth/login
{ "email": "john@example.com", "password": "wrong" }

// Expected Response (429):
{
  "error": "Too many login attempts",
  "code": "RATE_LIMITED",
  "resetTime": "2024-11-15T10:50:00Z",
  "retryAfter": 300
}

// Test Cases:
✓ First 5 attempts → 401 (invalid)
✓ 6th attempt within 15 min → 429 (rate limited)
✓ After 15 minutes → 401 (rate limit reset)
*/

// ============================================
// 9. TESTING WITH CURL
// ============================================

/*
// Register
curl -X POST http://localhost:8080/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'

// Login
curl -X POST http://localhost:8080/api/auth/login \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'

// Get profile (using saved cookies)
curl -X GET http://localhost:8080/api/auth/me \\
  -b cookies.txt

// With Bearer token
curl -X GET http://localhost:8080/api/auth/me \\
  -H "Authorization: Bearer [token_here]"

// Logout
curl -X POST http://localhost:8080/api/auth/logout \\
  -b cookies.txt
*/

// ============================================
// 10. TESTING EDGE CASES
// ============================================

/*
✓ Token with invalid signature
✓ Expired token
✓ Tampered token payload
✓ User deleted after token issued
✓ User role changed after token issued
✓ Concurrent requests with same token
✓ Token used on different IP
✓ Token used after logout (with blacklist)
✓ Very long token strings
✓ Null/undefined in request body
✓ XSS attempts in credentials
✓ SQL injection patterns in email
✓ Case sensitivity in email
✓ Whitespace in credentials
*/

// ============================================
// 11. PERFORMANCE TESTING
// ============================================

/*
// Test with Apache Bench
ab -n 1000 -c 10 -p data.json -T application/json \\
  http://localhost:8080/api/auth/login

// Test with loadtest
loadtest -c 100 -t 10 \\
  -p login.json \\
  -T application/json \\
  http://localhost:8080/api/auth/login

// Monitor response times and failed requests
*/

// ============================================
// 12. SECURITY TESTING
// ============================================

/*
// Test password hashing
✓ Same password hashes differently (bcrypt salt)
✓ Passwords never logged
✓ Old password doesn't work after reset

// Test token security
✓ Token not exposed in logs
✓ Token not in URL
✓ Secure flag set in production
✓ httpOnly flag prevents JS access
✓ sameSite=strict prevents CSRF

// Test authorization
✓ Cannot elevate own role
✓ Cannot access admin endpoints
✓ Cannot modify other users
✓ Cannot delete own admin access

// Test rate limiting
✓ Blocks brute force attempts
✓ Resets after time window
✓ Per-user enforcement
✓ IP-based fallback
*/

export { };
