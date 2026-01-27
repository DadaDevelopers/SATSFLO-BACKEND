# Satsflow Backend API

A production-ready Node.js backend for Satsflow - a period tracking mobile app with Bitcoin Lightning Network rewards and community features.

## Features

- **Period Tracking**: Track cycles, periods, and get predictions
- **Health Monitoring**: Log symptoms and moods with encryption
- **Analytics**: Cycle insights and health pattern analysis
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Data Encryption**: AES-256-GCM encryption for sensitive health data
- **RESTful API**: Mobile-optimized endpoints with consistent responses
- **Supabase Integration**: PostgreSQL database with Row Level Security

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT (access + refresh tokens)
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting, bcrypt

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/Dada-Developers/SATSFLO-BACKEND.git
cd SATSFLO-BACKEND

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate encryption key
npm run generate-key
# Copy output to ENCRYPTION_KEY in .env

# Start development server
npm run dev
```

### Environment Setup

Edit `.env` with your values:

```env
# Server
NODE_ENV=development
PORT=3000

# Supabase (from your project settings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# JWT (generate with: npm run generate-key)
JWT_SECRET=your_32_char_minimum_secret
JWT_REFRESH_SECRET=another_32_char_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (generate with: npm run generate-key)
ENCRYPTION_KEY=your_64_char_hex_key

# Email (optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

### Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the schema from `src/database/schema.sql`
4. Seed test data (optional):

```bash
npm run seed
```

## Project Structure

```
src/
├── app.js              # Express app configuration
├── server.js           # Server entry point
├── config/             # Configuration files
│   ├── database.js     # Database config
│   ├── jwt.js          # JWT config
│   └── supabase.js     # Supabase client
├── controllers/        # Request handlers
│   ├── auth/           # Authentication
│   ├── cycle/          # Period tracking
│   ├── health/         # Symptoms & moods
│   └── user/           # User profile
├── middleware/         # Express middleware
│   ├── auth.js         # JWT verification
│   ├── errorHandler.js # Error handling
│   ├── rateLimiter.js  # Rate limiting
│   └── validator.js    # Validation
├── routes/             # Route definitions
├── services/           # Business logic
│   ├── auth.service.js
│   ├── cycle.service.js
│   ├── health.service.js
│   └── user.service.js
├── utils/              # Utility functions
│   ├── constants.js    # App constants
│   ├── encryption.js   # AES encryption
│   ├── logger.js       # Logging
│   └── response.js     # API responses
├── validators/         # Input validation
└── database/           # Schema & seeds
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout user |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password/:token` | Reset password |
| PUT | `/api/v1/auth/change-password` | Change password |
| GET | `/api/v1/auth/me` | Get current user |

### User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/profile` | Get profile |
| PUT | `/api/v1/users/profile` | Update profile |
| GET | `/api/v1/users/health-profile` | Get health profile |
| PUT | `/api/v1/users/health-profile` | Update health profile |
| GET | `/api/v1/users/preferences` | Get preferences |
| PUT | `/api/v1/users/preferences` | Update preferences |
| DELETE | `/api/v1/users/account` | Delete account |
| GET | `/api/v1/users/export` | Export user data |

### Cycle Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/cycles/start` | Start new period |
| POST | `/api/v1/cycles/end` | End period |
| POST | `/api/v1/cycles/log` | Log daily entry |
| GET | `/api/v1/cycles/current` | Get current cycle |
| GET | `/api/v1/cycles/predictions` | Get predictions |
| GET | `/api/v1/cycles/analytics` | Get analytics |
| GET | `/api/v1/cycles` | Get cycle history |
| GET | `/api/v1/cycles/:id` | Get cycle details |
| PUT | `/api/v1/cycles/:id` | Update cycle |
| DELETE | `/api/v1/cycles/:id` | Delete cycle |

### Health (Symptoms & Moods)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/health/symptoms` | Log symptom |
| POST | `/api/v1/health/symptoms/batch` | Log multiple symptoms |
| GET | `/api/v1/health/symptoms` | Get symptoms |
| GET | `/api/v1/health/symptoms/date/:date` | Get symptoms by date |
| PUT | `/api/v1/health/symptoms/:id` | Update symptom |
| DELETE | `/api/v1/health/symptoms/:id` | Delete symptom |
| POST | `/api/v1/health/moods` | Log mood |
| POST | `/api/v1/health/moods/batch` | Log multiple moods |
| GET | `/api/v1/health/moods` | Get moods |
| GET | `/api/v1/health/moods/date/:date` | Get moods by date |
| PUT | `/api/v1/health/moods/:id` | Update mood |
| DELETE | `/api/v1/health/moods/:id` | Delete mood |
| GET | `/api/v1/health/analytics/symptoms` | Symptom analytics |
| GET | `/api/v1/health/analytics/moods` | Mood analytics |
| GET | `/api/v1/health/summary/:date` | Daily summary |

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Authentication

Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

When the access token expires, use the refresh token to get a new one:

```bash
POST /api/v1/auth/refresh
{
  "refreshToken": "your_refresh_token"
}
```

## Development

```bash
# Start with hot reload
npm run dev

# Run linter
npm run lint

# Format code
npm run format

# Seed database
npm run seed
```

## Security Features

- **Password Hashing**: bcrypt with 12 rounds
- **Health Data Encryption**: AES-256-GCM
- **JWT Tokens**: Short-lived access tokens + refresh tokens
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Comprehensive validation on all inputs
- **CORS**: Configurable cross-origin policies
- **Security Headers**: Helmet middleware
- **SQL Injection Protection**: Parameterized queries via Supabase

## For Dev 2 (Lightning/Community)

Reserved tables and endpoints for Bitcoin Lightning integration:
- `wallets` - User Lightning wallets
- `rewards` - Satoshi rewards tracking
- `forums` - Community forums
- `forum_posts` - Forum posts/replies
- `messages` - Direct messaging

See `src/database/schema.sql` for table structures.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Dada-Developers/SATSFLO-BACKEND/issues).
