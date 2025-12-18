/**
 * ReconciliationModal Component - Shows reconciliation progress
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { ReconciliationStatus, type ReconciliationProgress } from '../../types';

export interface ReconciliationModalProps {
  open: boolean;
  progress: ReconciliationProgress;
}

const ReconciliationModal = ({
  open,
  progress,
}: ReconciliationModalProps) => {
  const getStepIcon = (
    status: 'pending' | 'running' | 'completed' | 'failed'
  ) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'running':
        return <CircularProgress size={24} />;
      case 'failed':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      default:
        return <RadioButtonUnchecked sx={{ color: 'grey.400' }} />;
    }
  };

  const progressPercentage = (progress.currentStep / progress.totalSteps) * 100;

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Running Reconciliation
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Please wait while we process your data
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block', textAlign: 'center' }}
          >
            Step {progress.currentStep} of {progress.totalSteps}
          </Typography>
        </Box>

        <List>
          {progress.steps.map((step) => (
            <ListItem
              key={step.id}
              sx={{
                borderLeft: 3,
                borderColor:
                  step.status === 'completed'
                    ? 'success.main'
                    : step.status === 'running'
                    ? 'primary.main'
                    : step.status === 'failed'
                    ? 'error.main'
                    : 'grey.300',
                mb: 1,
                borderRadius: 1,
                backgroundColor:
                  step.status === 'running' ? 'action.hover' : 'transparent',
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {getStepIcon(step.status)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: step.status === 'running' ? 600 : 400,
                    }}
                  >
                    {step.name}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        {progress.status === ReconciliationStatus.FAILED && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: 'error.lighter',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="error.main">
              Reconciliation failed. Please try again or contact support.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReconciliationModal;
