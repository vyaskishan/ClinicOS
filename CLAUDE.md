# CLAUDE.md - AI Assistant Guide for ClinicOS

## Project Overview

**ClinicOS** is a clinic/healthcare management operating system designed to streamline medical practice operations, patient management, and clinical workflows.

**Status**: New Repository - This document will be updated as the codebase evolves.

### Key Objectives
- Provide efficient patient management and record-keeping
- Ensure HIPAA compliance and data security
- Streamline clinical workflows and appointment scheduling
- Support multi-user access with role-based permissions
- Enable reporting and analytics for clinic operations

---

## Repository Structure

### Current State
This is a new repository. The structure below represents the recommended organization as the project develops:

```
ClinicOS/
├── .github/              # GitHub workflows and templates
├── docs/                 # Documentation
│   ├── api/             # API documentation
│   ├── architecture/    # Architecture decision records
│   └── guides/          # User and developer guides
├── src/                 # Source code
│   ├── backend/         # Backend services
│   │   ├── api/        # API endpoints
│   │   ├── models/     # Data models
│   │   ├── services/   # Business logic
│   │   └── utils/      # Utility functions
│   ├── frontend/        # Frontend application
│   │   ├── components/ # React/Vue components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API clients
│   │   └── utils/      # Frontend utilities
│   └── shared/          # Shared code between frontend/backend
├── tests/               # Test files
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
├── scripts/             # Build and deployment scripts
├── config/              # Configuration files
└── migrations/          # Database migrations
```

### Key Files (To Be Created)
- `README.md` - Project overview and setup instructions
- `CONTRIBUTING.md` - Contribution guidelines
- `package.json` / `requirements.txt` - Dependency management
- `.env.example` - Environment variable template
- `docker-compose.yml` - Docker configuration

---

## Development Workflows

### Git Branch Strategy

**Main Branches:**
- `main` - Production-ready code
- `develop` - Integration branch for features
- `staging` - Pre-production testing

**Feature Branches:**
- Format: `feature/<feature-name>`
- Claude branches: `claude/<session-id>` (auto-generated)
- Bugfix branches: `bugfix/<issue-name>`
- Hotfix branches: `hotfix/<issue-name>`

### Commit Message Convention

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements
- `security`: Security improvements

**Examples:**
```
feat(patient): add patient registration form
fix(appointments): resolve double-booking issue
docs(api): update authentication endpoints
security(auth): implement rate limiting on login
```

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR with description of changes
6. Address review comments
7. Merge after approval

---

## Code Conventions

### General Principles

1. **Security First**: Always prioritize data security and HIPAA compliance
2. **Privacy by Design**: Handle PHI (Protected Health Information) with extreme care
3. **Defensive Programming**: Validate all inputs, sanitize all outputs
4. **Accessibility**: Ensure WCAG 2.1 AA compliance
5. **Performance**: Optimize for fast response times
6. **Maintainability**: Write self-documenting code with clear naming

### Security Guidelines

**Critical Rules for Healthcare Data:**

1. **Never log PHI** - Avoid logging patient names, SSNs, medical records
2. **Encrypt at rest and in transit** - All patient data must be encrypted
3. **Implement audit trails** - Track all access to patient records
4. **Use parameterized queries** - Prevent SQL injection
5. **Validate and sanitize** - All user inputs must be validated
6. **Implement RBAC** - Role-based access control for all features
7. **Session management** - Secure session handling with timeouts
8. **Data retention** - Follow HIPAA retention requirements

**Common Vulnerabilities to Avoid:**
- SQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Authentication bypass
- Insecure direct object references
- Sensitive data exposure
- Missing access controls

### Code Style

**Backend (Assume Node.js/Python until specified):**
- Use TypeScript for type safety (if Node.js)
- Use type hints (if Python)
- Follow RESTful API conventions
- Use async/await for asynchronous operations
- Implement proper error handling
- Use dependency injection
- Write unit tests for business logic

**Frontend (Assume React/Vue until specified):**
- Use functional components with hooks
- Implement proper state management
- Follow component composition patterns
- Use TypeScript for type safety
- Implement lazy loading for routes
- Optimize bundle size
- Write component tests

**Database:**
- Use migrations for schema changes
- Index frequently queried fields
- Avoid N+1 queries
- Use transactions for multi-step operations
- Implement soft deletes for audit purposes

### Naming Conventions

**Files and Directories:**
- Use kebab-case for file names: `patient-registration.ts`
- Use PascalCase for component files: `PatientForm.tsx`
- Use lowercase for directories: `components/`, `services/`

**Code:**
- Variables and functions: camelCase - `getUserById`, `patientName`
- Classes and interfaces: PascalCase - `PatientService`, `IUser`
- Constants: UPPER_SNAKE_CASE - `MAX_RETRY_ATTEMPTS`, `API_BASE_URL`
- Private members: prefix with underscore - `_privateMethod`

**Database:**
- Tables: plural snake_case - `patients`, `appointments`
- Columns: snake_case - `first_name`, `created_at`
- Foreign keys: `<table>_id` - `patient_id`, `doctor_id`

### Testing Standards

**Test Coverage:**
- Minimum 80% code coverage
- 100% coverage for security-critical code
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

**Test Structure:**
```
describe('Feature/Component Name', () => {
  describe('method/functionality', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## AI Assistant Guidelines

### Before Making Changes

1. **Read existing code first** - Never propose changes without understanding context
2. **Check for similar patterns** - Maintain consistency with existing code
3. **Review security implications** - Always consider HIPAA and security
4. **Understand dependencies** - Check how changes affect other parts
5. **Plan before coding** - Use TodoWrite for complex tasks

### When Implementing Features

**DO:**
- ✅ Follow existing patterns and conventions
- ✅ Add appropriate error handling
- ✅ Write tests for new functionality
- ✅ Update documentation
- ✅ Validate all user inputs
- ✅ Consider edge cases
- ✅ Implement audit logging for PHI access
- ✅ Use parameterized queries
- ✅ Check for existing utilities before creating new ones

**DON'T:**
- ❌ Log sensitive patient information
- ❌ Hardcode credentials or secrets
- ❌ Skip input validation
- ❌ Ignore error cases
- ❌ Over-engineer simple solutions
- ❌ Add unnecessary dependencies
- ❌ Create duplicate code
- ❌ Skip security considerations
- ❌ Commit commented-out code
- ❌ Use any `eval()` or similar dynamic execution

### Security Checklist

Before completing any task, verify:

- [ ] No PHI in logs, error messages, or debug output
- [ ] All inputs validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] Authentication and authorization checks in place
- [ ] Sensitive data encrypted
- [ ] CORS configured correctly
- [ ] Rate limiting on public endpoints
- [ ] Session timeout implemented
- [ ] Audit trail for data access
- [ ] Error messages don't leak sensitive info

### Common Tasks

**Adding a New API Endpoint:**
1. Define route in appropriate router file
2. Implement controller method
3. Add service layer logic
4. Create/update data models
5. Add input validation middleware
6. Implement authorization checks
7. Write unit and integration tests
8. Update API documentation

**Adding a New UI Component:**
1. Create component file in appropriate directory
2. Implement component with TypeScript
3. Add prop types/interfaces
4. Implement accessibility features
5. Add responsive styles
6. Write component tests
7. Update Storybook (if applicable)
8. Document props and usage

**Database Changes:**
1. Create migration file
2. Implement up and down migrations
3. Update data models
4. Add indexes for performance
5. Test migration on dev environment
6. Update seed data if needed
7. Document schema changes

### Debugging Approach

1. **Reproduce the issue** - Understand the problem fully
2. **Check logs** - Review application logs (remember: no PHI)
3. **Add debug output** - Temporary, non-sensitive debugging
4. **Isolate the problem** - Narrow down to specific component
5. **Review recent changes** - Check git history
6. **Test the fix** - Verify fix doesn't break other features
7. **Clean up** - Remove debug code before committing

### Performance Considerations

- Use database indexes appropriately
- Implement pagination for large datasets
- Cache frequently accessed, non-sensitive data
- Optimize database queries (avoid N+1)
- Use lazy loading for large components
- Implement debouncing for search inputs
- Monitor bundle size
- Use CDN for static assets

---

## Environment Setup

### Prerequisites (To Be Updated)

```bash
# Expected dependencies (update as project develops):
# - Node.js 18+ / Python 3.9+
# - PostgreSQL 14+ / MongoDB 6+
# - Docker and Docker Compose
# - Git
```

### Installation Steps (Placeholder)

```bash
# Clone repository
git clone <repository-url>
cd ClinicOS

# Install dependencies
# npm install (Node.js)
# pip install -r requirements.txt (Python)

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
# npm run migrate (Node.js)
# python manage.py migrate (Django)

# Start development server
# npm run dev (Node.js)
# python manage.py runserver (Django)
```

---

## Technology Stack (To Be Determined)

This section will be updated as technology choices are made:

### Backend Options
- Node.js + Express/NestJS + TypeScript
- Python + Django/FastAPI
- Java + Spring Boot

### Frontend Options
- React + TypeScript
- Vue.js + TypeScript
- Angular

### Database Options
- PostgreSQL (recommended for relational data)
- MongoDB (for flexible document storage)
- Redis (for caching)

### Infrastructure
- Docker for containerization
- Kubernetes for orchestration (production)
- AWS/Azure/GCP for cloud hosting
- CI/CD with GitHub Actions

---

## API Design Principles

### RESTful Conventions

**Endpoint Naming:**
- Use nouns, not verbs: `/patients` not `/getPatients`
- Use plural for collections: `/appointments`
- Use kebab-case: `/patient-records`
- Nested resources: `/patients/{id}/appointments`

**HTTP Methods:**
- `GET` - Retrieve resources
- `POST` - Create new resources
- `PUT` - Update entire resource
- `PATCH` - Partial update
- `DELETE` - Remove resource

**Status Codes:**
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `500` - Internal Server Error

**Response Format:**
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "metadata": {
    "page": 1,
    "perPage": 20,
    "total": 100
  }
}
```

**Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## Data Privacy and Compliance

### HIPAA Compliance Requirements

**Technical Safeguards:**
- Access controls (unique user IDs, emergency access)
- Audit controls (log access to PHI)
- Integrity controls (ensure data is not altered)
- Transmission security (encrypt data in transit)

**Administrative Safeguards:**
- Security management process
- Workforce training
- Incident response procedures
- Business associate agreements

**Physical Safeguards:**
- Facility access controls
- Workstation security
- Device and media controls

### Patient Data Handling

**PHI (Protected Health Information) includes:**
- Names, addresses, dates
- Social Security Numbers
- Medical record numbers
- Health plan numbers
- Device identifiers
- Biometric identifiers
- Photos
- Email addresses
- IP addresses

**When Working with PHI:**
1. Always use encryption (AES-256 at rest, TLS 1.2+ in transit)
2. Implement minimum necessary access
3. Log all access to PHI with user, timestamp, and action
4. Never transmit PHI in query parameters
5. Mask or redact PHI in UI when appropriate
6. Implement data retention and deletion policies
7. Use de-identification when possible for analytics

---

## Deployment Guidelines

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code review completed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup procedures in place
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### Deployment Process (To Be Defined)

1. Merge to staging branch
2. Run automated tests
3. Deploy to staging environment
4. Perform smoke tests
5. Security and penetration testing
6. User acceptance testing
7. Merge to main branch
8. Deploy to production
9. Monitor for issues
10. Update release notes

---

## Monitoring and Logging

### Logging Standards

**Log Levels:**
- `ERROR` - Critical issues requiring immediate attention
- `WARN` - Warning messages for potential issues
- `INFO` - General informational messages
- `DEBUG` - Detailed debugging information

**What to Log:**
- Application errors and exceptions
- Authentication attempts (success/failure)
- Authorization failures
- API requests (without PHI)
- Database query errors
- System performance metrics
- Security events

**What NOT to Log:**
- Passwords or credentials
- Patient names or identifiers
- Social Security Numbers
- Medical record details
- Payment card information
- Session tokens

### Monitoring Metrics

- Response time (p50, p95, p99)
- Error rate
- Request throughput
- Database connection pool
- Memory and CPU usage
- Disk space
- Active sessions
- Failed login attempts

---

## Troubleshooting Common Issues

### Database Connection Issues
1. Check database is running
2. Verify connection string
3. Check network connectivity
4. Verify credentials
5. Check connection pool settings

### Authentication Failures
1. Verify JWT secret is configured
2. Check token expiration
3. Verify user credentials
4. Check role permissions
5. Review session timeout settings

### Performance Issues
1. Check database query performance
2. Review server resource usage
3. Check for N+1 query problems
4. Verify caching is working
5. Profile slow endpoints
6. Check bundle size (frontend)

---

## Resources and References

### Healthcare Standards
- HIPAA Security Rule
- HIPAA Privacy Rule
- HL7 FHIR (Fast Healthcare Interoperability Resources)
- ICD-10 (Diagnosis codes)
- CPT (Procedure codes)

### Security Resources
- OWASP Top 10
- OWASP Healthcare Recommendations
- NIST Cybersecurity Framework
- CIS Controls

### Development Resources
- Project documentation (to be created)
- API documentation (to be created)
- Architecture decision records (to be created)

---

## Contact and Support

### Getting Help
- Check project documentation in `/docs`
- Review existing issues on GitHub
- Ask in team chat channels
- Consult with security team for PHI-related questions

### Reporting Security Issues
- **DO NOT** create public GitHub issues for security vulnerabilities
- Contact security team directly
- Use encrypted communication
- Follow responsible disclosure practices

---

## Changelog

### Version History

**v0.1.0 - 2025-12-09**
- Initial CLAUDE.md creation
- Established project structure and conventions
- Defined security guidelines and HIPAA requirements
- Set up development workflows

---

## Notes for AI Assistants

### Priority Order for Decision Making

1. **Security & Compliance** - Always the top priority
2. **Patient Safety** - Features affecting patient care
3. **Data Integrity** - Ensuring accurate medical records
4. **User Experience** - Usability for medical staff
5. **Performance** - System responsiveness
6. **Code Quality** - Maintainability and testing

### When in Doubt

- **For security questions**: Err on the side of caution
- **For data handling**: Assume data is PHI unless proven otherwise
- **For features**: Start simple, add complexity only when needed
- **For architecture**: Follow existing patterns
- **For unknowns**: Ask the user for clarification

### Evolution of This Document

This CLAUDE.md file should be updated when:
- Technology stack is finalized
- New patterns or conventions are established
- Architecture decisions are made
- New security requirements are identified
- Development workflows change
- New team members need onboarding information

**Remember**: This is a living document. Keep it current, accurate, and helpful for both AI assistants and human developers working on ClinicOS.
