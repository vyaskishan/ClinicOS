/**
 * FileUploadZone Component - Drag & drop file upload area
 */
import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Close,
} from '@mui/icons-material';
import type { FileUploadType } from '../../types';

export interface FileUploadZoneProps {
  title: string;
  type: FileUploadType;
  accept: { [key: string]: string[] };
  maxFiles?: number;
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
}

const FileUploadZone = ({
  title,
  type: _type,
  accept,
  maxFiles = 1,
  onUpload,
  disabled = false,
}: FileUploadZoneProps) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map((rej) => {
          if (rej.errors[0]?.code === 'file-invalid-type') {
            return 'Invalid file type';
          }
          if (rej.errors[0]?.code === 'too-many-files') {
            return `Maximum ${maxFiles} file(s) allowed`;
          }
          return rej.errors[0]?.message || 'File rejected';
        });
        setUploadError(errors.join(', '));
        setUploadStatus('error');
        return;
      }

      // Start upload
      if (acceptedFiles.length > 0) {
        setUploadStatus('uploading');
        setUploadProgress(0);
        setUploadError(null);

        try {
          // Simulate progress (in real app, this comes from upload callback)
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => {
              if (prev >= 90) {
                clearInterval(progressInterval);
                return 90;
              }
              return prev + 10;
            });
          }, 200);

          await onUpload(acceptedFiles);

          clearInterval(progressInterval);
          setUploadProgress(100);
          setUploadStatus('success');
          setUploadedFiles(acceptedFiles);

          // Reset status after 3 seconds
          setTimeout(() => {
            setUploadStatus('idle');
            setUploadProgress(0);
          }, 3000);
        } catch (error) {
          setUploadStatus('error');
          setUploadError(
            error instanceof Error ? error.message : 'Upload failed'
          );
        }
      }
    },
    [onUpload, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles,
    disabled: disabled || uploadStatus === 'uploading',
    multiple: maxFiles > 1,
  });

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
  };

  const getAcceptText = () => {
    const extensions = Object.values(accept).flat();
    return extensions.map((ext) => ext.replace('.', '').toUpperCase()).join(', ');
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        {title}
      </Typography>

      <Box
        {...getRootProps()}
        sx={{
          flex: 1,
          border: '2px dashed',
          borderColor: isDragActive
            ? 'primary.main'
            : uploadStatus === 'error'
            ? 'error.main'
            : uploadStatus === 'success'
            ? 'success.main'
            : 'grey.300',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          cursor: disabled || uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive
            ? 'action.hover'
            : uploadStatus === 'success'
            ? 'success.lighter'
            : 'background.paper',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: disabled || uploadStatus === 'uploading' ? undefined : 'primary.main',
            backgroundColor: disabled || uploadStatus === 'uploading' ? undefined : 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />

        {uploadStatus === 'uploading' && (
          <Box>
            <CloudUpload
              sx={{ fontSize: 48, color: 'primary.main', mb: 2 }}
            />
            <Typography variant="body1" gutterBottom>
              Uploading...
            </Typography>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ mt: 2 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {uploadProgress}%
            </Typography>
          </Box>
        )}

        {uploadStatus === 'success' && (
          <Box>
            <CheckCircle
              sx={{ fontSize: 48, color: 'success.main', mb: 2 }}
            />
            <Typography variant="body1" color="success.main">
              Upload Successful!
            </Typography>
            {uploadedFiles.length > 0 && (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                {uploadedFiles.map((file, index) => (
                  <Chip
                    key={index}
                    label={file.name}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}
          </Box>
        )}

        {uploadStatus === 'error' && (
          <Box>
            <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
            <Typography variant="body1" color="error.main" gutterBottom>
              Upload Failed
            </Typography>
            <Typography variant="caption" color="error.main">
              {uploadError}
            </Typography>
          </Box>
        )}

        {uploadStatus === 'idle' && (
          <Box>
            <CloudUpload
              sx={{
                fontSize: 48,
                color: isDragActive ? 'primary.main' : 'action.active',
                mb: 2,
              }}
            />
            <Typography variant="body1" gutterBottom>
              {isDragActive
                ? 'Drop files here'
                : `Drag & drop ${maxFiles > 1 ? 'files' : 'file'} here`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Accepts: {getAcceptText()}
              {maxFiles > 1 && ` (max ${maxFiles} files)`}
            </Typography>
          </Box>
        )}
      </Box>

      {uploadError && uploadStatus === 'error' && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <IconButton
              size="small"
              onClick={clearUploadedFiles}
            >
              <Close fontSize="small" />
            </IconButton>
          }
        >
          {uploadError}
        </Alert>
      )}
    </Paper>
  );
};

export default FileUploadZone;
