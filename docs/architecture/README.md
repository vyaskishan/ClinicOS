# Architecture Documentation

## System Architecture

ReconX follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│          Frontend (React)                │
│  - User Interface                        │
│  - State Management                      │
│  - Client-side Validation                │
└─────────────┬───────────────────────────┘
              │ HTTP/REST API
              │
┌─────────────▼───────────────────────────┐
│       Backend (Node.js/Express)          │
│  - API Routes                            │
│  - Business Logic                        │
│  - Authentication & Authorization        │
│  - File Processing (CSV/PDF)             │
│  - Fuzzy Matching Engine                 │
└─────────────┬───────────────────────────┘
              │ SQL
              │
┌─────────────▼───────────────────────────┐
│      Database (PostgreSQL)               │
│  - Data Storage                          │
│  - ACID Transactions                     │
│  - Audit Logging                         │
└─────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Axios** - HTTP client
- **React Query** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Schema validation

### Backend
- **Node.js 18+** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Helmet** - Security headers
- **Winston** - Logging
- **csv-parser** - CSV processing
- **pdf-parse** - PDF extraction
- **fuzzball** - Fuzzy string matching

### Database
- **PostgreSQL 14+** - Primary database
- **node-pg-migrate** - Migration management

## Design Patterns

### Backend Patterns
1. **MVC Pattern** - Separation of routes, controllers, and models
2. **Service Layer** - Business logic abstraction
3. **Repository Pattern** - Data access abstraction
4. **Middleware Chain** - Request processing pipeline
5. **Dependency Injection** - Loose coupling

### Frontend Patterns
1. **Component Composition** - Reusable UI components
2. **Custom Hooks** - Shared logic extraction
3. **Container/Presenter** - Smart vs presentational components
4. **Error Boundaries** - Graceful error handling

## Security Architecture

### Defense in Depth
1. **Network Layer** - HTTPS, rate limiting
2. **Application Layer** - Input validation, CSRF protection
3. **Authentication** - JWT with secure storage
4. **Authorization** - RBAC (Role-Based Access Control)
5. **Data Layer** - Encryption at rest, parameterized queries
6. **Audit Layer** - Comprehensive logging

### HIPAA Compliance
- **Access Controls** - Role-based permissions
- **Audit Trails** - All PHI access logged
- **Encryption** - Data at rest (AES-256) and in transit (TLS 1.2+)
- **Data Integrity** - Transaction management
- **Session Management** - Automatic timeout after inactivity

## File Processing Pipeline

```
Upload File (CSV/PDF)
       ↓
Validate Format
       ↓
Parse & Extract Data
       ↓
Validate Data Schema
       ↓
Store in Staging Table
       ↓
Run Reconciliation
       ↓
Generate Report
```

## Reconciliation Algorithm

1. **Exact Match** - Match by invoice number + amount
2. **Fuzzy Match** - Levenshtein distance on clinic name
3. **Date Range Match** - Match within ±3 days
4. **Amount Tolerance** - Match within ±$0.01
5. **Manual Review** - Flag remaining discrepancies

## Database Schema Design

### Core Entities
- **Users** - System users with roles
- **Clinics** - Medical clinic information
- **Invoices** - Invoice records
- **Payments** - Payment records
- **Reconciliations** - Match results
- **Audit Logs** - Activity tracking

### Relationships
- One clinic has many invoices
- One clinic has many payments
- One reconciliation links invoice to payment
- All entities have audit logs

## Scalability Considerations

### Current Scale (MVP)
- Single server deployment
- Up to 10,000 invoices/month
- Up to 100 concurrent users

### Future Scalability
- Horizontal scaling with load balancer
- Database read replicas
- Redis caching layer
- Background job processing (Bull/Agenda)
- File storage on S3/cloud storage

## Deployment Architecture (Future)

```
┌─────────────────────────────────────┐
│       Load Balancer (Nginx)         │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────┐
│Backend │   │Backend │
│Server 1│   │Server 2│
└───┬────┘   └───┬────┘
    │            │
    └──────┬─────┘
           │
    ┌──────▼──────┐
    │  PostgreSQL │
    │   Primary   │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  PostgreSQL │
    │   Replica   │
    └─────────────┘
```

## Monitoring & Observability

### Metrics to Track
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Active user sessions
- File processing throughput

### Logging Strategy
- **Application Logs** - Winston with log rotation
- **Access Logs** - HTTP request logging
- **Audit Logs** - HIPAA compliance tracking
- **Error Logs** - Detailed error traces

### Health Checks
- `/health` - Basic health status
- `/health/db` - Database connectivity
- `/health/ready` - Readiness probe (Kubernetes)

## Development Workflow

1. **Local Development** - Docker Compose for services
2. **Feature Branches** - Git flow with PR reviews
3. **Testing** - Unit, integration, and E2E tests
4. **CI/CD** - GitHub Actions for automated testing
5. **Staging** - Pre-production environment
6. **Production** - Blue-green deployment

## Performance Optimization

### Database
- Proper indexing on foreign keys and search columns
- Connection pooling (max 20 connections)
- Query optimization (avoid N+1 queries)
- Periodic VACUUM and ANALYZE

### Backend
- Response caching for read-heavy endpoints
- Pagination for large datasets
- Async file processing
- Compression (gzip)

### Frontend
- Code splitting and lazy loading
- Image optimization
- Bundle size optimization
- Service worker for offline support

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- 30-day retention policy
- Point-in-time recovery capability
- Off-site backup storage

### Recovery Plan
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 24 hours
- Documented restoration procedures
- Regular backup testing
