# DreamLauncher Backend API

Backend API service for Student Time Tracker, handling authentication, activity tracking, and real-time updates.

## Tech Stack

- **Node.js** with **TypeScript**
- **Express.js** for REST API
- **Socket.io** for WebSocket connections
- **PostgreSQL** for primary database
- **Redis** for caching and sessions
- **TypeORM** for database management
- **JWT** for authentication

## Features

- Google OAuth authentication
- Real-time activity tracking
- WebSocket support for live updates
- AI-powered categorization
- Analytics and reporting

## Local Development

### Prerequisites

- Node.ht >=20.0.0
- PostgreSQL
- Redis
- Google OAuth credentials

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your configuration:
   - Database credentials
   - Redis URL
   - Google OAuth credentials
   - JWT secrets

4. Run migrations:
   ```bash
   npm run migration:run
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:4051`

## Deployment

This backend is configured for deployment on Railway.

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed deployment instructions.

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/google` - Google OAuth login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - Logout

### Activity Endpoints

- `POST /api/v1/activities` - Record activity
- `GET /api/v1/activities` - Get activities
- `GET /api/v1/activities/stats` - Get activity statistics

### Health Check

- `GET /health` - Service health status

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `PORT` - Server port (default: 4051)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migration:create` - Create new migration
- `npm run migration:run` - Run pending migrations

## Architecture

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── entities/       # TypeORM entities
├── jobs/          # Background jobs
├── middlewares/   # Express middlewares
├── routes/        # API routes
├── services/      # Business logic
├── socket/        # WebSocket handlers
├── types/         # TypeScript types
└── utils/         # Helper utilities
```