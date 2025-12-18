/**
 * RecentActivityFeed Component - Displays recent reconciliation activity
 */

import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Pending,
  PlayCircle,
} from '@mui/icons-material';
import { useRecentActivity } from '../../hooks/useApi';
import { ReconciliationStatus } from '../../types';

const RecentActivityFeed = () => {
  const { data: activities, isLoading, error } = useRecentActivity(5);

  const getStatusIcon = (status: ReconciliationStatus) => {
    switch (status) {
      case ReconciliationStatus.COMPLETED:
        return <CheckCircle sx={{ color: 'success.main' }} />;
      case ReconciliationStatus.FAILED:
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case ReconciliationStatus.RUNNING:
        return <PlayCircle sx={{ color: 'primary.main' }} />;
      default:
        return <Pending sx={{ color: 'grey.500' }} />;
    }
  };

  const getStatusColor = (status: ReconciliationStatus) => {
    switch (status) {
      case ReconciliationStatus.COMPLETED:
        return 'success';
      case ReconciliationStatus.FAILED:
        return 'error';
      case ReconciliationStatus.RUNNING:
        return 'primary';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Recent Activity
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load recent activity
        </Alert>
      )}

      {isLoading ? (
        <List>
          {[1, 2, 3, 4, 5].map((item) => (
            <ListItem key={item}>
              <ListItemIcon>
                <Skeleton variant="circular" width={24} height={24} />
              </ListItemIcon>
              <ListItemText
                primary={<Skeleton variant="text" width="60%" />}
                secondary={<Skeleton variant="text" width="80%" />}
              />
            </ListItem>
          ))}
        </List>
      ) : activities && activities.length > 0 ? (
        <List>
          {activities.map((activity) => (
            <ListItem
              key={activity.id}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': {
                  borderBottom: 'none',
                },
              }}
            >
              <ListItemIcon>{getStatusIcon(activity.status)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Reconciliation Run
                    </Typography>
                    <Chip
                      label={activity.status}
                      size="small"
                      color={getStatusColor(activity.status) as any}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(activity.timestamp)}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Files: {activity.filesProcessed.invoices} invoices,{' '}
                      {activity.filesProcessed.payments} payments,{' '}
                      {activity.filesProcessed.remittances} remittances
                    </Typography>
                    <Typography variant="caption" display="block" color="success.main">
                      {activity.matchesFound} matches found
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No recent activity</Typography>
          <Typography variant="caption">
            Start by uploading files and running reconciliation
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default RecentActivityFeed;
