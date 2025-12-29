# REGRET Airdrop - API Documentation

## Base URL

```
https://regret-airdrop.vercel.app/api
```

## Authentication

Most endpoints are public. Admin endpoints require an `X-Admin-Token` header:

```
X-Admin-Token: YOUR_ADMIN_TOKEN
```

Admin token is set via environment variable `ADMIN_TOKEN`.

---

## Public Endpoints

### 1. Register Wallet

**Endpoint**: `POST /api/register`

Register a new Solana wallet to participate in the airdrop.

**Request Body**:
```json
{
  "wallet": "DemoSolanaAddressHere44CharactersBase58",
  "walletType": "phantom",
  "sessionId": "optional-session-id",
  "userAgent": "Mozilla/5.0...",
  "referrer": "REGRET-ABC123",
  "utmSource": "twitter",
  "utmMedium": "social",
  "utmCampaign": "launch"
}
```

**Required Fields**:
- `wallet` (string): Valid 44-character Solana address (base58)
- `walletType` (string): One of `phantom`, `solflare`, `backpack`

**Optional Fields**:
- `sessionId`: Session identifier for tracking
- `userAgent`: Browser user agent
- `referrer`: Referral code if registered via referral
- `utmSource`, `utmMedium`, `utmCampaign`: UTM tracking parameters

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "referralCode": "REGRET-ABCD1234",
    "tokens": 1000,
    "message": "Wallet registered successfully"
  }
}
```

**Response** (200 OK - Already Registered):
```json
{
  "success": true,
  "data": {
    "referralCode": "REGRET-ABCD1234",
    "tokens": 1000,
    "message": "Wallet already registered",
    "alreadyRegistered": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid wallet format or missing required fields
- `409 Conflict`: Wallet already registered (race condition)
- `500 Internal Server Error`: Database error

---

### 2. Get Statistics

**Endpoint**: `GET /api/stats`

Get current airdrop statistics.

**Query Parameters**: None

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalParticipants": 2547,
    "tokensReserved": 2547000,
    "tokensRemaining": 7453000,
    "tokensPercentage": 25,
    "participantsToday": 84,
    "totalSpins": 12453,
    "daysToLaunch": 7,
    "launchDate": "2025-01-12",
    "timestamp": "2024-01-05T10:30:45.123Z",
    "lastUpdated": "2024-01-05T10:25:00.000Z"
  }
}
```

**Error Responses**:
- `200 OK with fallback`: Database unavailable, returns cached statistics

---

### 3. Spin Wheel

**Endpoint**: `POST /api/spin`

Spin the wheel once per day to win tokens.

**Request Body**:
```json
{
  "wallet": "DemoSolanaAddressHere44CharactersBase58"
}
```

**Required Fields**:
- `wallet` (string): Valid 44-character Solana address

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "prize": 500,
    "newBalance": 1500,
    "message": "¡Felicitaciones! Ganaste 500 $REGRET",
    "nextSpin": "2024-01-06T10:30:45.123Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid wallet format or missing wallet
- `404 Not Found`: Wallet not registered
- `429 Too Many Requests`: Already spun today
- `500 Internal Server Error`: Database error or transaction failed

---

### 4. Add Referral

**Endpoint**: `POST /api/referrals/add`

Register a referred wallet and award tokens to referrer.

**Request Body**:
```json
{
  "referrerWallet": "ReferrerSolanaAddress44Characters",
  "referredWallet": "ReferredSolanaAddress44Characters",
  "referralCode": "REGRET-ABCD1234"
}
```

**Required Fields**:
- `referrerWallet`: Referrer's valid Solana address
- `referredWallet`: Referred wallet's valid Solana address
- `referralCode`: Referrer's referral code

**Validation Rules**:
- Referrer must be registered
- Referred wallet must be registered
- Both wallets must be different (no self-referral)
- Referred wallet can only be referred once
- Referral code must match referrer's code

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Referral added successfully! 500 $REGRET awarded.",
    "awardedTokens": 500,
    "referrerNewTokens": 2500
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid inputs or validation failed
- `404 Not Found`: Referrer or referred wallet not found
- `409 Conflict`: Wallet already referred
- `500 Internal Server Error`: Database error

---

### 5. Get Referral Statistics

**Endpoint**: `GET /api/referrals/wallet?wallet=ADDRESS&limit=100&offset=0`

Get referral statistics and list of referred wallets.

**Query Parameters**:
- `wallet` (required): Valid 44-character Solana address
- `limit` (optional): Results per page (default: 100, max: 500)
- `offset` (optional): Pagination offset (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "wallet": "ReferrerAddress44Characters",
    "referralCode": "REGRET-ABCD1234",
    "referralStats": {
      "totalReferrals": 15,
      "successfulReferrals": 15,
      "totalEarned": 7500,
      "currentTokens": 9500,
      "averageEarningsPerReferral": 500
    },
    "referrals": [
      {
        "referredWallet": "ReferredAddress44Characters",
        "tokensAwarded": 500,
        "referredAt": "2024-01-04T15:30:00.000Z",
        "referredWalletType": "solflare",
        "referredCurrentTokens": 1200,
        "referredTotalSpins": 3
      }
    ],
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 15,
      "hasMore": false,
      "pages": 1,
      "currentPage": 1
    },
    "registeredAt": "2024-01-01T10:00:00.000Z",
    "lastActive": "2024-01-05T10:30:45.123Z",
    "timestamp": "2024-01-05T10:30:45.123Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid wallet format
- `404 Not Found`: Wallet not registered
- `500 Internal Server Error`: Database error

---

### 6. Health Check

**Endpoint**: `GET /api/health`

Check API and database health status.

**Response** (200 OK - Healthy):
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-05T10:30:45.123Z",
  "service": "$REGRET Airdrop API",
  "version": "1.0.0",
  "endpoints": {
    "/api/register": "POST - Register wallet",
    "/api/spin": "POST - Spin wheel",
    "/api/stats": "GET - Get statistics",
    "/api/referrals/add": "POST - Add referral",
    "/api/referrals/wallet": "GET - Get referral stats",
    "/api/health": "GET - Health check"
  },
  "environment": "production",
  "database": {
    "status": "healthy",
    "version": "PostgreSQL 14",
    "timestamp": "2024-01-05T10:30:45.123Z",
    "configured": true
  },
  "region": "iad1",
  "uptime": 3600.5
}
```

**Response** (503 Service Unavailable - Unhealthy):
```json
{
  "success": false,
  "status": "unhealthy",
  "timestamp": "2024-01-05T10:30:45.123Z",
  "error": "Database connectivity check failed",
  "code": "DB_UNAVAILABLE"
}
```

---

## Admin Endpoints

All admin endpoints require `X-Admin-Token` header.

### 1. Admin Dashboard

**Endpoint**: `GET /api/admin/dashboard?period=day`

Get comprehensive dashboard statistics.

**Query Parameters**:
- `period` (optional): `day`, `week`, or `month` (default: `day`)

**Headers**:
```
X-Admin-Token: YOUR_ADMIN_TOKEN
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-05T10:30:45.123Z",
    "period": "day",
    "overview": {
      "totalParticipants": 2547,
      "tokensReserved": 2547000,
      "participantsToday": 84,
      "totalSpins": 12453
    },
    "userMetrics": {
      "total": 2547,
      "periodNew": 84,
      "periodActive": 234,
      "conversionRate": "9.19"
    },
    "spinMetrics": {
      "totalSpins": 12453,
      "periodSpins": 523,
      "averagePrize": "617",
      "medianPrize": "500",
      "minPrize": 100,
      "maxPrize": 1500
    },
    "referralMetrics": {
      "totalReferrals": 1247,
      "periodReferrals": 42,
      "totalTokensAwarded": 623500,
      "averagePerReferral": 500
    },
    "topReferrers": [
      {
        "wallet": "ABCDE...FGHIJ",
        "referrals": 47,
        "earned": 23500,
        "totalTokens": 34500,
        "registeredAt": "2024-01-01T10:00:00.000Z"
      }
    ],
    "walletDistribution": [
      {
        "type": "phantom",
        "count": 1500,
        "percentage": 58.91
      }
    ],
    "recentRegistrations": [
      {
        "wallet": "ABCDE...FGHIJ",
        "walletType": "phantom",
        "registeredAt": "2024-01-05T10:20:00.000Z",
        "utmSource": "twitter",
        "utmMedium": "social",
        "utmCampaign": null
      }
    ],
    "activeSessions": {
      "activeSessions": 45,
      "uniqueUsers": 42,
      "lastActivity": "2024-01-05T10:30:00.000Z"
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing admin token
- `403 Forbidden`: Invalid admin token
- `500 Internal Server Error`: Dashboard error

---

### 2. Admin Operations

**Endpoint**: `POST /api/admin/operations`

Execute administrative database operations.

**Request Body**:
```json
{
  "operation": "rebuild_stats",
  "admin_token": "YOUR_ADMIN_TOKEN",
  "confirm": "yes"
}
```

**Headers**:
```
X-Admin-Token: YOUR_ADMIN_TOKEN
```

**Available Operations**:

#### `rebuild_stats`
Rebuild global statistics from actual data.
- No `confirm` parameter needed
- Returns updated stats

#### `purge_old_data`
Delete analytics and spin data older than 30 days.
- Requires: `"confirm": "yes"`
- Returns: Count of deleted rows

#### `reset_test_data`
Reset all data and sequences (development only).
- Requires: `"confirm": "yes"`
- Returns: List of cleared tables

#### `health_check`
Check database health and integrity.
- No `confirm` parameter needed
- Returns: Health status of all tables

**Response** (200 OK):
```json
{
  "success": true,
  "operation": "rebuild_stats",
  "timestamp": "2024-01-05T10:30:45.123Z",
  "data": {
    "message": "Global stats rebuilt",
    "stats": {
      "totalParticipants": 2547,
      "tokensReserved": 2547000,
      "participantsToday": 84
    }
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid operation or missing confirmation
- `401 Unauthorized`: Missing admin token
- `403 Forbidden`: Invalid admin token
- `500 Internal Server Error`: Operation failed

---

## Command Line Interface

Admin CLI tool for local administration:

```bash
# Show current statistics
npm run admin:stats

# Check database health
npm run admin:health

# List recent participants
npm run admin:list

# Export participants to CSV
npm run admin:export

# Rebuild statistics
npm run admin:rebuild-stats

# Purge old data (30+ days)
npm run admin:purge

# Reset test data (WARNING: destructive)
npm run admin:reset

# Run all endpoint tests
npm run test:endpoints
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_FIELDS` | 400 | Required field missing from request |
| `INVALID_ADDRESS` | 400 | Invalid Solana address format |
| `INVALID_WALLET_TYPE` | 400 | Invalid wallet type |
| `INVALID_PERIOD` | 400 | Invalid period parameter |
| `CONFIRMATION_REQUIRED` | 400 | Destructive operation requires confirmation |
| `MISSING_WALLET` | 400 | Wallet parameter missing |
| `MISSING_TOKEN` | 401 | Admin token missing |
| `INVALID_TOKEN` | 403 | Admin token invalid |
| `WALLET_NOT_FOUND` | 404 | Wallet not registered |
| `REFERRER_NOT_FOUND` | 404 | Referrer wallet not found |
| `REFERRED_NOT_FOUND` | 404 | Referred wallet not found |
| `WALLET_EXISTS` | 409 | Wallet already registered |
| `ALREADY_REFERRED` | 409 | Wallet already has referrer |
| `ALREADY_SPUN_TODAY` | 429 | Daily spin limit reached |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `TRANSACTION_FAILED` | 500 | Database transaction failed |
| `DB_UNAVAILABLE` | 503 | Database unavailable |

---

## Rate Limiting

The API implements rate limiting via:
1. **Database unique constraints** - Prevents duplicate registrations and daily spins
2. **Daily spin limit** - One spin per wallet per 24 hours
3. **Referral limit** - Each wallet can only be referred once

For high-volume applications, consider adding middleware-level rate limiting (Cloudflare, Redis, etc.).

---

## CORS Policy

CORS is restricted to the production domain by default:
```
Access-Control-Allow-Origin: https://regret-airdrop.vercel.app
```

To allow additional origins, modify `CORS_ORIGIN` environment variable in Vercel.

---

## Caching

- **Stats endpoint**: Returns real-time data, falls back to cached data if DB unavailable
- **API responses**: Marked as `no-cache` to ensure freshness
- **Static assets**: Cached for 1 year (immutable)

---

## Examples

### cURL Examples

**Register wallet**:
```bash
curl -X POST https://regret-airdrop.vercel.app/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "DemoSolanaAddressHere44CharactersBase58",
    "walletType": "phantom"
  }'
```

**Get statistics**:
```bash
curl https://regret-airdrop.vercel.app/api/stats
```

**Spin wheel**:
```bash
curl -X POST https://regret-airdrop.vercel.app/api/spin \
  -H "Content-Type: application/json" \
  -d '{"wallet": "DemoSolanaAddressHere44CharactersBase58"}'
```

**Get referrals**:
```bash
curl "https://regret-airdrop.vercel.app/api/referrals/wallet?wallet=DemoSolanaAddressHere44CharactersBase58&limit=20"
```

**Admin dashboard**:
```bash
curl -H "X-Admin-Token: YOUR_TOKEN" \
  "https://regret-airdrop.vercel.app/api/admin/dashboard?period=day"
```

### JavaScript Examples

**Register**:
```javascript
const response = await fetch('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: 'DemoSolanaAddressHere44CharactersBase58',
    walletType: 'phantom'
  })
});
const data = await response.json();
```

---

## Webhooks (Future)

Planned webhook support for:
- User registration events
- Wheel spin events
- Referral completion events
- Daily statistics

---

**API Version**: 1.1
**Last Updated**: January 2024
**Status**: Production Ready ✅
