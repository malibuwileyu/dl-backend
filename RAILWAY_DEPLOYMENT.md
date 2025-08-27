# Railway Deployment Guide

## Prerequisites
1. Create a Railway account at https://railway.app
2. Install Railway CLI: `brew install railwayapp/railway/railway` (or from https://docs.railway.app/develop/cli)
3. Get your Google OAuth credentials from the current .env file

## Deployment Steps

### 1. Login to Railway
```bash
railway login
```

### 2. Create a new project
```bash
cd /Users/ryanheron/Projects/trilogy/DreamLauncher/student-time-tracker/backend
railway init
```

### 3. Add PostgreSQL and Redis
In the Railway dashboard:
1. Click "New" → "Database" → "Add PostgreSQL"
2. Click "New" → "Database" → "Add Redis"

### 4. Configure Environment Variables
In the Railway dashboard, go to your service settings and add these variables:

```env
# JWT Secrets (generate secure random strings)
JWT_SECRET=<generate-32-char-random-string>
JWT_REFRESH_SECRET=<generate-another-32-char-random-string>

# Google OAuth (from your current .env)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# CORS (important!)
CORS_ORIGINS=https://your-railway-app.up.railway.app,studenttimetracker://auth-callback

# Port
PORT=4051
```

**To generate secure secrets, run:**
```bash
openssl rand -base64 32
```

### 5. Deploy
```bash
railway up
```

### 6. Get your production URL
After deployment, Railway will provide a URL like:
`https://your-app-name.up.railway.app`

### 7. Update Google OAuth Redirect URIs
Add these to your Google Cloud Console OAuth client:
- `https://your-app-name.up.railway.app/api/v1/auth/google/callback`
- `studenttimetracker://auth-callback`

### 8. Update the macOS App
In `StudentTimeTrackerApp.swift`, change:
```swift
authService = AuthService(apiUrl: "https://your-app-name.up.railway.app")
```

## Environment Variables Reference

Railway automatically provides:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Port to listen on (Railway assigns this)

You need to provide:
- `JWT_SECRET` - For signing JWT tokens
- `JWT_REFRESH_SECRET` - For refresh tokens  
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `CORS_ORIGINS` - Allowed origins (include your Railway URL)

## Monitoring

Check logs:
```bash
railway logs
```

Open in browser:
```bash
railway open
```

## Troubleshooting

1. **Google OAuth Error**: Make sure redirect URIs are correctly configured in Google Cloud Console
2. **CORS Issues**: Ensure CORS_ORIGINS includes your Railway URL and `studenttimetracker://auth-callback`
3. **Database Connection**: Railway provides DATABASE_URL automatically, don't override it
4. **Port Issues**: Let Railway assign the PORT, it handles this automatically

## Next Steps

After successful deployment:
1. Test the health endpoint: `https://your-app-name.up.railway.app/health`
2. Update the macOS app with the production URL
3. Test Google Sign In flow
4. Monitor logs for any issues