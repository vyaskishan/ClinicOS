/**
 * Dashboard Component - Main ReconX Dashboard
 */
import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  PlayArrow,
  Visibility,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import StatsGrid from './StatsGrid';
import FileUploadZone from './FileUploadZone';
import RecentActivityFeed from './RecentActivityFeed';
import ReconciliationModal from './ReconciliationModal';
import {
  useUploadInvoices,
  useUploadPayments,
  useUploadRemittances,
  useRunReconciliation,
} from '../../hooks/useApi';
import {
  FileUploadType,
  type ReconciliationProgress,
  ReconciliationStatus,
} from '../../types';

const Dashboard = () => {
  const [reconciliationProgress, setReconciliationProgress] = useState<ReconciliationProgress | null>(null);

  // Upload mutations
  const uploadInvoicesMutation = useUploadInvoices();
  const uploadPaymentsMutation = useUploadPayments();
  const uploadRemittancesMutation = useUploadRemittances();

  // Reconciliation mutation
  const runReconciliationMutation = useRunReconciliation();

  // Handle file uploads
  const handleUploadInvoices = async (files: File[]) => {
    try {
      const result = await uploadInvoicesMutation.mutateAsync(files[0]);
      toast.success(`Successfully uploaded ${result.recordsProcessed} invoices`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoices');
      throw error;
    }
  };

  const handleUploadPayments = async (files: File[]) => {
    try {
      const result = await uploadPaymentsMutation.mutateAsync(files[0]);
      toast.success(`Successfully uploaded ${result.recordsProcessed} payments`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload payments');
      throw error;
    }
  };

  const handleUploadRemittances = async (files: File[]) => {
    try {
      const result = await uploadRemittancesMutation.mutateAsync(files);
      toast.success(`Successfully uploaded ${result.fileCount} remittance files`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload remittances');
      throw error;
    }
  };

  // Handle reconciliation
  const handleRunReconciliation = async () => {
    // Initialize progress
    setReconciliationProgress({
      currentStep: 0,
      totalSteps: 3,
      status: ReconciliationStatus.RUNNING,
      steps: [
        {
          id: 1,
          name: 'Direct Matching',
          description: 'Matching invoices with exact payment amounts',
          status: 'running',
        },
        {
          id: 2,
          name: 'Remittance Processing',
          description: 'Extracting and matching data from remittance PDFs',
          status: 'pending',
        },
        {
          id: 3,
          name: 'Fuzzy Matching',
          description: 'Applying fuzzy logic to find potential matches',
          status: 'pending',
        },
      ],
    });

    try {
      // Simulate progress updates (in real app, use polling or websockets)
      setTimeout(() => {
        setReconciliationProgress((prev) => prev ? {
          ...prev,
          currentStep: 1,
          steps: prev.steps.map((step) =>
            step.id === 1
              ? { ...step, status: 'completed' }
              : step.id === 2
              ? { ...step, status: 'running' }
              : step
          ),
        } : null);
      }, 2000);

      setTimeout(() => {
        setReconciliationProgress((prev) => prev ? {
          ...prev,
          currentStep: 2,
          steps: prev.steps.map((step) =>
            step.id === 2
              ? { ...step, status: 'completed' }
              : step.id === 3
              ? { ...step, status: 'running' }
              : step
          ),
        } : null);
      }, 4000);

      const result = await runReconciliationMutation.mutateAsync({});

      setReconciliationProgress((prev) => prev ? {
        ...prev,
        currentStep: 3,
        status: ReconciliationStatus.COMPLETED,
        steps: prev.steps.map((step) => ({ ...step, status: 'completed' })),
      } : null);

      toast.success(`Reconciliation complete! Found ${result.totalMatches} matches`);

      // Close modal after 2 seconds
      setTimeout(() => {
        setReconciliationProgress(null);
      }, 2000);
    } catch (error) {
      setReconciliationProgress((prev) => prev ? {
        ...prev,
        status: ReconciliationStatus.FAILED,
        steps: prev.steps.map((step) =>
          step.status === 'running' ? { ...step, status: 'failed' } : step
        ),
      } : null);
      toast.error(error instanceof Error ? error.message : 'Reconciliation failed');
    }
  };

  const handleViewResults = () => {
    toast.info('Results page navigation will be implemented');
    // In a real app: navigate('/results')
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', backgroundColor: 'grey.50' }}>
      {/* Header */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            ReconX - Invoice Reconciliation
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Summary Statistics */}
        <Box sx={{ mb: 4 }}>
          <StatsGrid />
        </Box>

        {/* Upload Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Upload Files
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FileUploadZone
                title="Invoices CSV"
                type={FileUploadType.INVOICES}
                accept={{ 'text/csv': ['.csv'] }}
                maxFiles={1}
                onUpload={handleUploadInvoices}
                disabled={uploadInvoicesMutation.isPending}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FileUploadZone
                title="Bank Feed CSV"
                type={FileUploadType.PAYMENTS}
                accept={{ 'text/csv': ['.csv'] }}
                maxFiles={1}
                onUpload={handleUploadPayments}
                disabled={uploadPaymentsMutation.isPending}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FileUploadZone
                title="Remittance PDFs"
                type={FileUploadType.REMITTANCES}
                accept={{ 'application/pdf': ['.pdf'] }}
                maxFiles={10}
                onUpload={handleUploadRemittances}
                disabled={uploadRemittancesMutation.isPending}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Action Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleRunReconciliation}
              disabled={runReconciliationMutation.isPending}
              sx={{
                px: 4,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Run Reconciliation
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Visibility />}
              onClick={handleViewResults}
              sx={{
                px: 4,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              View Results
            </Button>
          </Box>
        </Paper>

        {/* Recent Activity */}
        <Box>
          <RecentActivityFeed />
        </Box>
      </Container>

      {/* Reconciliation Progress Modal */}
      {reconciliationProgress && (
        <ReconciliationModal
          open={true}
          progress={reconciliationProgress}
        />
      )}
    </Box>
  );
};

export default Dashboard;
