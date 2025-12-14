# Database Seeds

This directory contains seed data for development and testing.

## Important Security Notes

⚠️ **NEVER commit real patient data or PHI to seed files**

- Use only synthetic/fake data for development
- Ensure test data doesn't resemble real patient information
- Use data generators for realistic but fake healthcare data

## Running Seeds

```bash
npm run seed
```

## Seed Files

Create seed files for:
- Development user accounts (with hashed passwords)
- Sample clinic data
- Test invoice records
- Sample payment data

All seed data should be clearly marked as test data and never contain real PHI.
