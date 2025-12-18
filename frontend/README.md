# ReconX Dashboard - Frontend

## Overview

ReconX is an invoice reconciliation dashboard built with React, TypeScript, and Material-UI. This application helps streamline the process of matching invoices with payments and remittances.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - Component library
- **TanStack React Query** - Data fetching and caching
- **React Dropzone** - File upload handling
- **Axios** - HTTP client
- **React Toastify** - Toast notifications

## Features

- 📊 **Summary Dashboard** - Real-time statistics of uploads and reconciliations
- 📁 **File Upload** - Drag & drop support for CSV and PDF files
- 🔄 **Reconciliation Engine** - Multi-level matching (direct, remittance, fuzzy)
- 📋 **Activity Feed** - Track recent reconciliation runs
- 🎨 **Responsive Design** - Mobile-first, works on all screen sizes
- ⚡ **Real-time Updates** - React Query for efficient data fetching
- 🔔 **Toast Notifications** - User feedback for all actions
- 🛡️ **Error Boundaries** - Graceful error handling

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your API endpoint
# VITE_API_BASE_URL=http://localhost:3000/api
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── api/                  # API client and services
│   ├── client.ts        # Axios configuration
│   └── services.ts      # API service functions
├── components/           # React components
│   ├── dashboard/       # Dashboard-specific components
│   │   ├── Dashboard.tsx
│   │   ├── StatsCard.tsx
│   │   ├── StatsGrid.tsx
│   │   ├── FileUploadZone.tsx
│   │   ├── RecentActivityFeed.tsx
│   │   └── ReconciliationModal.tsx
│   └── shared/          # Shared components
│       └── ErrorBoundary.tsx
├── hooks/               # Custom React hooks
│   └── useApi.ts       # React Query hooks
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── theme.ts        # Material-UI theme config
├── App.tsx              # Root component
└── main.tsx            # Entry point
```

## API Integration

The dashboard integrates with the following API endpoints:

- `POST /api/upload/invoices` - Upload invoices CSV
- `POST /api/upload/payments` - Upload payments CSV
- `POST /api/upload/remittances` - Upload remittance PDFs
- `GET /api/stats/summary` - Get summary statistics
- `POST /api/reconcile/run` - Run reconciliation
- `GET /api/activity/recent` - Get recent activity

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3000/api` |
| `VITE_ENV` | Environment | `development` |

## Features in Detail

### File Upload

Three upload zones support different file types:
- **Invoices CSV** - Single CSV file with invoice data
- **Bank Feed CSV** - Single CSV file with payment data
- **Remittance PDFs** - Multiple PDF files (max 10)

Each upload zone provides:
- Drag & drop interface
- File type validation
- Upload progress tracking
- Success/error feedback

### Reconciliation Process

When reconciliation runs, it goes through three steps:

1. **Direct Matching** - Exact amount matching between invoices and payments
2. **Remittance Processing** - Extract and match data from PDFs
3. **Fuzzy Matching** - Intelligent matching for similar transactions

Progress is shown in a modal with real-time updates.

### Summary Statistics

Five key metrics displayed:
- Total Invoices Uploaded
- Total Payments Uploaded
- Matched Transactions
- Unmatched Transactions
- Total $ Reconciled

## Styling and Theming

Material-UI theme is configured in `src/utils/theme.ts`:

- Custom color palette
- Typography settings
- Component overrides
- Responsive breakpoints

## Error Handling

Multiple layers of error handling:

1. **Error Boundary** - Catches React component errors
2. **API Error Handling** - Axios interceptors for API errors
3. **Toast Notifications** - User-friendly error messages
4. **Form Validation** - Client-side file type validation

## Development Guidelines

### Code Style

- Use TypeScript for all new files
- Follow functional component pattern with hooks
- Use Material-UI components for consistency
- Implement proper error handling
- Add loading states for async operations

### State Management

- Use React Query for server state
- Use local state (useState) for UI state
- Context API for global app state (if needed)

### API Calls

Always use the React Query hooks from `hooks/useApi.ts`:

```typescript
import { useSummaryStats, useUploadInvoices } from '../hooks/useApi';

// In component
const { data, isLoading, error } = useSummaryStats();
const uploadMutation = useUploadInvoices();
```

## Testing

```bash
# Run tests (to be implemented)
npm run test

# Run tests with coverage
npm run test:coverage
```

## Performance Optimization

- Code splitting with React.lazy (future)
- Image optimization
- Memoization for expensive computations
- React Query caching
- Lazy loading for large lists

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## License

Proprietary - ClinicOS

## Support

For issues or questions, please contact the development team.
