/**
 * StatsGrid Component - Grid layout for summary statistics
 */
import { Grid } from '@mui/material';
import {
  Description,
  Payment,
  CheckCircle,
  Cancel,
  AttachMoney,
} from '@mui/icons-material';
import StatsCard from './StatsCard';
import { useSummaryStats } from '../../hooks/useApi';

const StatsGrid = () => {
  const { data: stats, isLoading } = useSummaryStats();

  // Default values when data is not available
  const displayStats = {
    totalInvoicesUploaded: stats?.totalInvoicesUploaded ?? 0,
    totalPaymentsUploaded: stats?.totalPaymentsUploaded ?? 0,
    matchedTransactions: stats?.matchedTransactions ?? 0,
    unmatchedTransactions: stats?.unmatchedTransactions ?? 0,
    totalReconciled: stats?.totalReconciled ?? 0,
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={4} lg={2}>
        <StatsCard
          title="Invoices Uploaded"
          value={displayStats.totalInvoicesUploaded}
          icon={Description}
          color="#1976d2"
          loading={isLoading}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2}>
        <StatsCard
          title="Payments Uploaded"
          value={displayStats.totalPaymentsUploaded}
          icon={Payment}
          color="#9c27b0"
          loading={isLoading}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2}>
        <StatsCard
          title="Matched Transactions"
          value={displayStats.matchedTransactions}
          icon={CheckCircle}
          color="#2e7d32"
          loading={isLoading}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2}>
        <StatsCard
          title="Unmatched Transactions"
          value={displayStats.unmatchedTransactions}
          icon={Cancel}
          color="#d32f2f"
          loading={isLoading}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2}>
        <StatsCard
          title="Total Reconciled"
          value={displayStats.totalReconciled}
          icon={AttachMoney}
          color="#ed6c02"
          prefix="$"
          loading={isLoading}
        />
      </Grid>
    </Grid>
  );
};

export default StatsGrid;
