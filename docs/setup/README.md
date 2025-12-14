# Setup Guide

## Prerequisites

Before setting up ReconX, ensure you have the following installed:

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **PostgreSQL** 14 or higher
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ClinicOS
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### 3. Set Up Environment Variables

#### Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` with your configuration:

```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reconx_dev
DB_USER=your_username
DB_PASSWORD=your_password
JWT_SECRET=your-super-secret-jwt-key
```

#### Frontend

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

Edit `packages/frontend/.env` if needed (defaults should work).

#### Database

```bash
cp packages/database/.env.example packages/database/.env
```

Edit with your database connection string.

### 4. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE reconx_dev;

# Create user (if needed)
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE reconx_dev TO your_username;

# Exit
\q
```

### 5. Run Database Migrations

```bash
npm run db:migrate
```

### 6. Start Development Servers

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
npm run backend:dev
```

**Terminal 2 - Frontend:**
```bash
npm run frontend:dev
```

### 7. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm test -w packages/backend

# Run frontend tests only
npm test -w packages/frontend
```

### Database Migrations

```bash
# Create a new migration
npm run db:migrate:create your_migration_name

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:down

# Check migration status
npm run db:migrate:status
```

### Code Linting

```bash
# Run linter for all packages
npm run lint

# Run linter for specific package
npm run lint -w packages/backend
npm run lint -w packages/frontend
```

### Building for Production

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w packages/backend
npm run build -w packages/frontend
```

## Docker Setup (Optional)

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Troubleshooting

### Port Already in Use

If you get "Port already in use" errors:

```bash
# Find process using port 3000 or 3001
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Database Connection Error

1. Verify PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check your `.env` database credentials

3. Ensure database exists:
   ```bash
   psql -U postgres -l
   ```

### Module Not Found Errors

```bash
# Clean and reinstall
npm run clean
npm install
```

### TypeScript Errors

```bash
# Rebuild TypeScript
npm run build
```

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- PostgreSQL (cweijan.vscode-postgresql-client2)

### Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Testing Setup

### Running Tests in Watch Mode

```bash
# Backend
npm run test:watch -w packages/backend

# Frontend
npm run test:watch -w packages/frontend
```

### Coverage Reports

```bash
npm run test:coverage
```

## Security Setup

### Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use the output as your `JWT_SECRET` in `.env`.

### HTTPS for Development (Optional)

Use mkcert for local HTTPS:

```bash
# Install mkcert
brew install mkcert  # macOS
# or
choco install mkcert  # Windows

# Generate certificates
mkcert -install
mkcert localhost
```

## Next Steps

After setup:

1. Review the [Architecture Documentation](../architecture/README.md)
2. Check the [API Documentation](../api/README.md)
3. Read the [CLAUDE.md](../../CLAUDE.md) for development guidelines
4. Start implementing features!

## Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review logs in the terminal
3. Check the GitHub issues
4. Contact the development team
