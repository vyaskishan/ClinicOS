# Database Schema

This directory contains the database schema documentation and SQL definitions.

## Schema Overview

The ReconX database is designed to handle invoice reconciliation for medical clinics with HIPAA compliance in mind.

### Core Tables (to be created via migrations)

1. **users** - System users with role-based access
2. **clinics** - Medical clinic information
3. **invoices** - Invoice records
4. **payments** - Payment records
5. **reconciliations** - Reconciliation results
6. **audit_logs** - Audit trail for HIPAA compliance

### Security Considerations

- All PHI (Protected Health Information) is encrypted at rest
- Row-level security for multi-tenant data isolation
- Audit logging for all data access and modifications
- Soft deletes for data retention requirements

## Migration Workflow

```bash
# Create a new migration
npm run migrate:create <migration-name>

# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

## Naming Conventions

- Tables: plural, snake_case (e.g., `users`, `invoice_items`)
- Columns: snake_case (e.g., `first_name`, `created_at`)
- Indexes: `idx_<table>_<column(s)>` (e.g., `idx_invoices_clinic_id`)
- Foreign keys: `fk_<table>_<column>` (e.g., `fk_invoices_clinic_id`)
