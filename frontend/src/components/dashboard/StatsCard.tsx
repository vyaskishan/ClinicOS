/**
 * StatsCard Component - Displays individual statistic card
 */
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

export interface StatsCardProps {
  title: string;
  value: number | string;
  icon: SvgIconComponent;
  color?: string;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

const StatsCard = ({
  title,
  value,
  icon: Icon,
  color = '#1976d2',
  prefix = '',
  suffix = '',
  loading = false,
}: StatsCardProps) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      // Format large numbers with commas
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              gutterBottom
              sx={{ fontWeight: 500 }}
            >
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width="80%" height={40} />
            ) : (
              <Typography
                variant="h4"
                component="div"
                sx={{
                  fontWeight: 'bold',
                  color: 'text.primary',
                  mt: 1,
                }}
              >
                {prefix}
                {formatValue(value)}
                {suffix}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '12px',
              backgroundColor: `${color}15`,
              ml: 2,
            }}
          >
            <Icon
              sx={{
                fontSize: 32,
                color: color,
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
