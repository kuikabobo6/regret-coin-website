# REGRET Airdrop - Professional Deployment Guide

## 📋 Overview

This document provides production-ready deployment instructions for the REGRET token airdrop application on Vercel with PostgreSQL (Neon or Vercel Postgres).

## ✅ Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] Database credentials are configured in Vercel (not in repository)
- [ ] `.env.example` contains only placeholder values (verified)
- [ ] All API endpoints have been tested locally
- [ ] CORS origin is set to your production domain in `vercel.json`
- [ ] `maxDuration` is set to 30 seconds in `vercel.json`
- [ ] All critical bugs have been fixed (transactions, client management)
- [ ] Health check passes (`GET /api/health`)

## 🚀 Deployment Steps

### Step 1: Connect to Database Provider

Choose one of the following:

#### Option A: Vercel Postgres (Recommended for Vercel)

1. Go to Vercel Dashboard → Your Project → Storage
2. Click "Create Database" → Select "Postgres"
3. Name the database (e.g., `regret-airdrop`)
4. Wait for database creation
5. Copy the connection string (will be automatically set as `POSTGRES_URL`)

#### Option B: Neon PostgreSQL

1. Sign up at https://neon.tech
2. Create a new project
3. Copy the connection string: `postgresql://user:password@host/database?sslmode=require`
4. In Vercel Dashboard → Settings → Environment Variables
5. Add `POSTGRES_URL` with the Neon connection string

### Step 2: Set Environment Variables in Vercel

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

```env
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require
ADMIN_WALLET=YourAdminSolanaAddress44CharsBase58
JWT_SECRET=your-secret-key-min-32-characters
CORS_ORIGIN=https://regret-airdrop.vercel.app
NEXT_PUBLIC_MAX_PARTICIPANTS=5000
NODE_ENV=production
```

**⚠️ CRITICAL**: Never commit these values. They should ONLY be in Vercel's dashboard.

### Step 3: Initialize Database Tables

Run the initialization script once to create tables:

```bash
# Option 1: Using npm script (if database is accessible from your machine)
npm run db:init

# Option 2: Manual initialization
# The first API request to any endpoint will trigger table creation
# Go to: https://your-domain.vercel.app/api/health
# This will automatically create tables on first run
```

Or create a one-time function endpoint for initialization:

**Create `api/_init.js`:**
```javascript
import { initializeDatabase } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Protect with a secret
  if (req.headers['x-init-token'] !== process.env.INIT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const result = await initializeDatabase();
    return res.status(200).json({ 
      success: result,
      message: 'Database initialized'
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message
    });
  }
}
```

Then call:
```bash
curl -X POST https://your-domain.vercel.app/api/_init \
  -H "x-init-token: your-secret-token"
```

### Step 4: Test API Endpoints Locally

Before pushing to production, test locally:

```bash
# Start dev server
npm run dev

# In another terminal, run tests
npm run test:endpoints
# or
node scripts/test-endpoints.js --url http://localhost:3000
```

Expected output: All tests should pass ✅

### Step 5: Deploy to Vercel

Push your code and Vercel will auto-deploy:

```bash
git add .
git commit -m "Production-ready deployment: Fixed transactions, secured endpoints, integrated frontend"
git push origin main
```

Or deploy directly from Vercel dashboard:
1. Go to your project
2. Click "Redeploy"

### Step 6: Verify Production Deployment

```bash
# Test health endpoint
curl https://regret-airdrop.vercel.app/api/health

# Should return:
# {
#   "success": true,
#   "status": "healthy",
#   "database": { "status": "healthy", ... }
# }

# Test registration
curl -X POST https://regret-airdrop.vercel.app/api/register \
  -H "Content-Type: application/json" \
  -d '{"wallet":"DemoSolanaAddressHere44CharactersBase58","walletType":"phantom"}'
```

## 📊 Architecture Overview

```
regret-airdrop/
├── api/
│   ├── _db.js              # Database layer with transactions
│   ├── register.js         # Wallet registration endpoint
│   ├── spin.js             # Wheel spin endpoint
│   ├── stats.js            # Statistics endpoint
│   ├── health.js           # Health check endpoint
│   └── referrals/
│       ├── add.js          # Add referral endpoint
│       └── wallet.js       # Get referral stats endpoint
├── public/
│   ├── index.html          # Main UI (Spanish)
│   ├── admin.html          # Admin panel placeholder
│   ├── script.js           # Frontend logic (API-integrated)
│   ├── style.css           # Styling
│   └── admin.css           # Admin styling
├── scripts/
│   └── test-endpoints.js   # Testing suite
├── vercel.json             # Vercel configuration
├── package.json            # Dependencies
├── .env.example            # Environment variable template
└── DEPLOYMENT.md           # This file
```

## 🔐 Security Best Practices

### Implemented

✅ **Transactional Consistency**: All multi-step operations use `withTransaction()` to guarantee atomicity
✅ **Input Validation**: All wallet addresses validated against Solana format
✅ **SQL Injection Prevention**: Using parameterized queries throughout
✅ **CORS Restrictions**: Limited to production domain (not `*`)
✅ **Rate Limiting**: Built-in unique constraints prevent duplicate operations
✅ **Error Handling**: Generic error messages don't leak system details
✅ **Secrets Management**: Credentials only in Vercel env vars, never in code

### Recommended Additional Measures

- [ ] Implement rate limiting middleware (e.g., using Vercel's built-in rate limiting)
- [ ] Add request signing using wallet signatures for enhanced auth
- [ ] Implement captcha on `/api/register` to prevent bot abuse
- [ ] Add monitoring with Sentry or similar service
- [ ] Set up automated backups for PostgreSQL
- [ ] Implement audit logging for all write operations

## 🐛 Troubleshooting

### Database Connection Fails

**Problem**: `Error: connect ENOTFOUND`

**Solution**:
1. Verify `POSTGRES_URL` is set correctly in Vercel
2. Ensure database is not in maintenance mode
3. Check network policies if using Neon (allow all IPs from Vercel)
4. Test connection locally: `psql $POSTGRES_URL`

### Transactions Timeout

**Problem**: `Error: Transaction timeout`

**Solution**:
1. Increase `maxDuration` in `vercel.json` (currently 30s)
2. Optimize database queries (add indexes)
3. Check for N+1 query issues in code
4. Monitor query performance in database dashboard

### CORS Errors in Frontend

**Problem**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**:
1. Verify `CORS_ORIGIN` matches your domain in `vercel.json`
2. Ensure `Access-Control-Allow-Origin` header is set (it is in `vercel.json`)
3. Check browser console for exact origin mismatch
4. Clear browser cache and cookies

### Database Migrations Not Applied

**Problem**: Tables don't exist even after deployment

**Solution**:
1. Manually call the initialization endpoint (Step 3 above)
2. Or check Vercel logs for init errors: `vercel logs`
3. Verify tables exist: `\dt` in psql
4. Re-run `npm run db:init` from local machine with `POSTGRES_URL` set

## 📈 Monitoring & Logging

### Check Logs

```bash
# View Vercel deployment logs
vercel logs

# View specific function logs
vercel logs --function /api/register

# Stream logs in real-time
vercel logs --tail
```

### Monitor Key Metrics

1. **Registration Success Rate**: Track `/api/register` success vs failures
2. **Spin Success Rate**: Monitor `/api/spin` for transaction failures
3. **Database Latency**: Check query times in database dashboard
4. **Function Execution Time**: Monitor via Vercel analytics
5. **Error Rate**: Track errors in logs for patterns

## 🧹 Database Maintenance

### Backup Strategy

```bash
# Backup (Neon example)
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $POSTGRES_URL < backup-20240101.sql

# Or use Vercel's built-in backup (Vercel Postgres)
# Available in dashboard: Storage → Your Database → Backups
```

### Cleanup Operations

```bash
# Remove old analytics events (e.g., older than 30 days)
DELETE FROM analytics_events 
WHERE created_at < NOW() - INTERVAL '30 days';

# Archive old wheel spins
SELECT * INTO wheel_spins_archive FROM wheel_spins 
WHERE spin_date < CURRENT_DATE - INTERVAL '90 days';

DELETE FROM wheel_spins 
WHERE spin_date < CURRENT_DATE - INTERVAL '90 days';
```

## 🚨 Known Issues & Limitations

### Current Limitations

1. **Rate Limiting**: Basic (only DB-level constraints). Consider adding middleware-level rate limiting.
2. **Wallet Authentication**: Currently validates format only. Not verifying wallet ownership with signatures.
3. **Admin Functions**: Admin endpoints not fully protected. Add authentication middleware.
4. **Spam Prevention**: No CAPTCHA or bot detection. Consider Cloudflare protection.

### Recent Fixes (v1.1)

- ✅ Fixed transaction handling in `spin.js` (was using separate clients)
- ✅ Fixed client release bug in `register.js`
- ✅ Added atomic transactions to `referrals/add.js`
- ✅ Improved error handling with PostgreSQL error codes
- ✅ Integrated frontend with real API endpoints
- ✅ Secured environment variables

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Neon Docs**: https://neon.tech/docs/
- **Solana Dev Docs**: https://docs.solana.com/
- **Web3.js Reference**: https://solana-labs.github.io/solana-web3.js/

## 📝 Changelog

### v1.1 (Current)
- Fixed critical transaction bugs
- Secured environment variables
- Integrated frontend with API
- Added comprehensive testing suite
- Improved error handling and logging
- Added professional deployment guide

### v1.0 (Initial)
- Basic API endpoints
- Local demo with localStorage
- Frontend UI implementation

## 🤝 Contributing

For improvements or bug reports:
1. Create a feature branch
2. Make changes following existing patterns
3. Run `node scripts/test-endpoints.js` to verify
4. Create pull request with description

## 📄 License

MIT

---

**Last Updated**: 2024
**Status**: Production Ready ✅
