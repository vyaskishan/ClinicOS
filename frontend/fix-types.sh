#!/bin/bash

# Fix FileUploadZone.tsx
sed -i "s/import React, { useState, useCallback } from 'react';/import { useState, useCallback } from 'react';/" src/components/dashboard/FileUploadZone.tsx
sed -i "s/import { useDropzone, FileRejection } from 'react-dropzone';/import { useDropzone, type FileRejection } from 'react-dropzone';/" src/components/dashboard/FileUploadZone.tsx
sed -i "s/} from '@mui\/icons-material';/} from '@mui\/icons-material';\nimport type { FileUploadType } from '..\/..\/types';/" src/components/dashboard/FileUploadZone.tsx
sed -i "s/import { FileUploadType } from '..\/..\/types';//" src/components/dashboard/FileUploadZone.tsx

# Fix StatsCard.tsx
sed -i "s/import React from 'react';//" src/components/dashboard/StatsCard.tsx
sed -i "s/import { SvgIconComponent } from '@mui\/icons-material';/import type { SvgIconComponent } from '@mui\/icons-material';/" src/components/dashboard/StatsCard.tsx

# Fix StatsGrid.tsx
sed -i "s/import React from 'react';//" src/components/dashboard/StatsGrid.tsx
sed -i "s/import { Grid } from '@mui\/material';/import Grid2 as Grid from '@mui\/material\/Grid2';/" src/components/dashboard/StatsGrid.tsx

# Fix RecentActivityFeed.tsx
sed -i "s/import React from 'react';//" src/components/dashboard/RecentActivityFeed.tsx
sed -i "s/import { ReconciliationStatus } from '..\/..\/types';/import { ReconciliationStatus, type ActivityItem } from '..\/..\/types';/" src/components/dashboard/RecentActivityFeed.tsx

# Fix ReconciliationModal.tsx
sed -i "s/import React from 'react';//" src/components/dashboard/ReconciliationModal.tsx
sed -i "s/import { ReconciliationProgress, ReconciliationStatus } from '..\/..\/types';/import { ReconciliationStatus, type ReconciliationProgress } from '..\/..\/types';/" src/components/dashboard/ReconciliationModal.tsx

# Fix ErrorBoundary.tsx
sed -i "s/import React, { Component, ErrorInfo, ReactNode } from 'react';/import { Component, type ErrorInfo, type ReactNode } from 'react';/" src/components/shared/ErrorBoundary.tsx
sed -i "s/process.env.NODE_ENV/import.meta.env.MODE/" src/components/shared/ErrorBoundary.tsx

echo "Type fixes applied!"
