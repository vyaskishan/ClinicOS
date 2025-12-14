# ReconX API Documentation

## Overview

The ReconX API provides endpoints for invoice reconciliation, file uploads, and reporting for medical clinic operations.

**Base URL:** `http://localhost:3001/api/v1`

**Version:** 0.1.0

## Authentication

All API endpoints (except public endpoints) require JWT authentication.

```http
Authorization: Bearer <your-jwt-token>
```

## Security & HIPAA Compliance

- All endpoints use HTTPS in production
- Rate limiting is enabled (100 requests per 15 minutes)
- All PHI access is logged in audit trails
- Session timeout: 30 minutes of inactivity

## API Endpoints (To Be Implemented)

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token

### Invoices
- `GET /invoices` - List all invoices
- `GET /invoices/:id` - Get invoice details
- `POST /invoices` - Create new invoice
- `PUT /invoices/:id` - Update invoice
- `DELETE /invoices/:id` - Delete invoice
- `POST /invoices/upload/csv` - Upload CSV file
- `POST /invoices/upload/pdf` - Upload PDF file

### Payments
- `GET /payments` - List all payments
- `GET /payments/:id` - Get payment details
- `POST /payments` - Record new payment

### Reconciliation
- `POST /reconcile` - Run reconciliation
- `GET /reconcile/:id` - Get reconciliation results
- `GET /reconcile/history` - View reconciliation history

### Reports
- `GET /reports/summary` - Get reconciliation summary
- `GET /reports/discrepancies` - Get discrepancy report
- `GET /reports/export` - Export report

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": []
  }
}
```

## Rate Limiting

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Common Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Data Privacy

⚠️ **Important:** Never include PHI in query parameters or URL paths. Always use request body for sensitive data.
