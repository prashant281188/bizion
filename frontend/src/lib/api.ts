// ============================================================
// Bizion — Axios API Instance
// ============================================================

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_ROUTES } from './constants';

// ----- Token Storage (in-memory for security) -----

let accessToken: string | null = null;
let isRefreshing = false;
let failedQueue: {
  resolve: (value: string | null) => void;
  reject: (error: unknown) => void;
}[] = [];

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ----- Process failed queue -----

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

// ----- Axios Instance -----

// Use current hostname for local network mobile testing
const isBrowser = typeof window !== 'undefined';
const defaultHost = isBrowser ? window.location.hostname : 'localhost';
const defaultApiUrl = `http://${defaultHost}:3000/api/v1`;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || defaultApiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies for refresh token
});

// ----- Request Interceptor -----

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// ----- Response Interceptor -----

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // If we get a 401 and haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if the request is login, register, or refresh itself
      if (
        originalRequest.url === API_ROUTES.AUTH.REFRESH ||
        originalRequest.url === API_ROUTES.AUTH.LOGIN ||
        originalRequest.url === API_ROUTES.AUTH.REGISTER
      ) {
        accessToken = null;
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to retry after refresh completes
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post(API_ROUTES.AUTH.REFRESH);
        const newToken = data.data.accessToken as string;
        accessToken = newToken;
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        accessToken = null;
        // Redirect to login if we can't refresh
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
