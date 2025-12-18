/**
 * API Client Configuration
 */
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiError, type ApiResponse } from '../types';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    // Handle API errors
    if (error.response?.data?.error) {
      const apiError = new ApiError(
        error.response.data.error.message,
        error.response.data.error.code,
        error.response.data.error.details
      );
      return Promise.reject(apiError);
    }

    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Request timeout', 'TIMEOUT'));
    }

    if (!error.response) {
      return Promise.reject(new ApiError('Network error', 'NETWORK_ERROR'));
    }

    // Handle generic errors
    return Promise.reject(
      new ApiError(
        error.message || 'An unexpected error occurred',
        'UNKNOWN_ERROR'
      )
    );
  }
);

export default apiClient;
