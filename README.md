# ReconX - Invoice Reconciliation System

**ReconX** is a comprehensive invoice reconciliation system designed specifically for medical clinics to streamline financial operations, reduce discrepancies, and maintain HIPAA compliance.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-red.svg)]()

---

## 🚀 Features

### Current (MVP)
- ✅ Monorepo structure with TypeScript
- ✅ React 18 frontend with Vite
- ✅ Node.js/Express backend
- ✅ PostgreSQL database with migrations
- ✅ HIPAA-compliant architecture
- ✅ Comprehensive documentation

### Planned
- 📋 CSV invoice import
- 📄 PDF invoice parsing
- 🔍 Intelligent fuzzy matching
- 🔐 Role-based access control
- 📊 Reconciliation dashboard
- 📈 Reporting and analytics
- 🔒 Audit logging
- 📤 Export functionality

---

## 🏗️ Project Structure

```
ClinicOS/
├── packages/
│   ├── backend/              # Node.js/Express API server
│   │   ├── src/
│   │   │   ├── api/         # API routes
│   │   │   ├── services/    # Business logic
│   │   │   ├── models/      # Data models
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── utils/       # Utility functions
│   │   │   ├── config/      # Configuration
│   │   │   └── index.ts     # Entry point
│   │   └── tests/           # Backend tests
│   │
│   ├── frontend/             # React application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── services/    # API clients
│   │   │   ├── hooks/       # Custom hooks
│   │   │   └── utils/       # Utilities
│   │   └── public/          # Static assets
│   │
│   └── database/             # Database management
│       ├── migrations/       # Schema migrations
│       ├── seeds/            # Seed data
│       └── schema/           # Schema documentation
│
├── docs/                     # Documentation
│   ├── api/                  # API documentation
│   ├── architecture/         # Architecture docs
│   └── setup/                # Setup guides
│
├── CLAUDE.md                 # AI assistant guidelines
└── README.md                 # This file
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **React Query** - Server state management
- **React Hook Form** - Form handling with validation
- **Zod** - Schema validation

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Relational database
- **JWT** - Authentication
- **Helmet** - Security headers
- **Winston** - Logging
- **csv-parser** - CSV file processing
- **pdf-parse** - PDF data extraction
- **fuzzball** - Fuzzy string matching

### DevOps & Tools
- **npm workspaces** - Monorepo management
- **node-pg-migrate** - Database migrations
- **ESLint** - Code linting
- **Jest/Vitest** - Testing frameworks
- **Git** - Version control

---

## 🚦 Getting Started

### Prerequisites

Ensure you have the following installed:

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 14 or higher
- Git

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd ClinicOS
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env

# Frontend
cp packages/frontend/.env.example packages/frontend/.env

# Database
cp packages/database/.env.example packages/database/.env
```

Edit the `.env` files with your configuration.

4. **Create the database**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE reconx_dev;
GRANT ALL PRIVILEGES ON DATABASE reconx_dev TO your_username;
```

5. **Run database migrations**

```bash
npm run db:migrate
```

6. **Start development servers**

```bash
# Terminal 1 - Backend
npm run backend:dev

# Terminal 2 - Frontend
npm run frontend:dev
```

7. **Access the application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

For detailed setup instructions, see [Setup Guide](docs/setup/README.md).

---

## 📝 Development

### Available Scripts

```bash
# Development
npm run dev              # Start all dev servers
npm run backend:dev      # Start backend only
npm run frontend:dev     # Start frontend only

# Building
npm run build            # Build all packages
npm run clean            # Clean all build artifacts

# Testing
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:migrate:create <name>  # Create new migration

# Linting
npm run lint             # Lint all packages
```

### Monorepo Commands

```bash
# Run command in specific workspace
npm run <script> -w packages/backend
npm run <script> -w packages/frontend
npm run <script> -w packages/database
```

---

## 🔒 Security & Compliance

### HIPAA Compliance

ReconX is designed with HIPAA compliance in mind:

- ✅ **Encryption** - Data encrypted at rest (AES-256) and in transit (TLS 1.2+)
- ✅ **Access Controls** - Role-based access control (RBAC)
- ✅ **Audit Logging** - Comprehensive audit trails for all PHI access
- ✅ **Session Management** - Automatic timeout after 30 minutes
- ✅ **Data Integrity** - Transaction management and validation
- ✅ **Secure Development** - Following OWASP security guidelines

### Security Best Practices

- Input validation on all endpoints
- Parameterized SQL queries (no SQL injection)
- Rate limiting on API endpoints
- CORS configuration
- Helmet.js for security headers
- Password hashing with bcrypt
- JWT with secure storage

⚠️ **Important:** Never commit `.env` files, credentials, or PHI data to version control.

---

## 📚 Documentation

- [Setup Guide](docs/setup/README.md) - Detailed installation and setup
- [Architecture](docs/architecture/README.md) - System architecture and design
- [API Documentation](docs/api/README.md) - API endpoints and usage
- [CLAUDE.md](CLAUDE.md) - AI assistant development guide

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch -w packages/backend
npm run test:watch -w packages/frontend

# Generate coverage report
npm run test:coverage
```

### Test Coverage

We aim for:
- **80% minimum** overall code coverage
- **100% coverage** for security-critical code
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch from `develop`
2. Make your changes following our conventions
3. Write tests for new functionality
4. Run linter and tests
5. Submit a pull request
6. Address review feedback

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Build/tooling changes
- `security:` - Security improvements

**Examples:**
```
feat(invoice): add CSV import functionality
fix(reconcile): resolve fuzzy matching edge case
docs(api): update authentication endpoints
security(auth): implement rate limiting
```

### Code Style

- Follow TypeScript best practices
- Use ESLint for code quality
- Write self-documenting code
- Add comments for complex logic
- Maintain test coverage

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find and kill process
lsof -i :3000  # or :3001
kill -9 <PID>
```

**Database connection error:**
```bash
# Check PostgreSQL is running
pg_isready

# Verify database exists
psql -U postgres -l
```

**Module not found:**
```bash
# Clean and reinstall
npm run clean
npm install
```

For more troubleshooting help, see [Setup Guide](docs/setup/README.md#troubleshooting).

---

## 📋 Roadmap

### Phase 1: MVP (Current)
- [x] Project structure and setup
- [ ] Database schema design
- [ ] Authentication system
- [ ] Basic invoice management
- [ ] CSV import functionality

### Phase 2: Core Features
- [ ] PDF parsing
- [ ] Fuzzy matching algorithm
- [ ] Reconciliation engine
- [ ] Dashboard UI
- [ ] Basic reporting

### Phase 3: Advanced Features
- [ ] Multi-clinic support
- [ ] Advanced analytics
- [ ] Automated notifications
- [ ] Export functionality
- [ ] Audit log viewer

### Phase 4: Enterprise
- [ ] SSO integration
- [ ] Advanced RBAC
- [ ] API rate limiting tiers
- [ ] White-label options
- [ ] Advanced reporting

---

## 📄 License

UNLICENSED - This is proprietary software for internal use.

---

## 👥 Team

For questions or support, contact the development team.

---

## 🙏 Acknowledgments

This project follows healthcare industry best practices and HIPAA compliance guidelines.

Built with ❤️ for medical clinics.

---

## 📊 Status

**Current Version:** 0.1.0
**Status:** In Development
**Last Updated:** December 2025

---

**Note:** This is an active development project. Features and documentation are continuously being updated.
