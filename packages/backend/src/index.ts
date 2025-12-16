import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import uploadRoutes from './api/upload.routes';
import reconcileRoutes from './api/reconcile.routes';
import remittanceRoutes from './api/remittance.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/reconcile', reconcileRoutes);
app.use('/api/remittances', remittanceRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ReconX API',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'ReconX API Server',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      upload: {
        invoices: 'POST /api/upload/invoices',
        payments: 'POST /api/upload/payments'
      },
      reconcile: {
        direct: 'POST /api/reconcile/direct',
        stats: 'GET /api/reconcile/stats'
      },
      remittances: {
        upload: 'POST /api/remittances/upload',
        match: 'POST /api/remittances/match',
        list: 'GET /api/remittances',
        get: 'GET /api/remittances/:id'
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ReconX API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
