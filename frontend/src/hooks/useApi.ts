'use client';

// ============================================================
// Bizion — useApi Hook
// ============================================================

import { useCallback, useRef, useState } from 'react';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import api from '@/lib/api';
import type { ApiErrorResponse } from '@/types';

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  fieldErrors: Record<string, string[]> | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (config?: AxiosRequestConfig) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom hook for making API calls with loading/error state management.
 *
 * @example
 * const { data, error, isLoading, execute } = useApi<Product[]>();
 *
 * useEffect(() => {
 *   execute({ url: '/products', method: 'GET' });
 * }, [execute]);
 */
export function useApi<T>(defaultConfig?: AxiosRequestConfig): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    fieldErrors: null,
    isLoading: false,
  });

  // Track the latest request to handle race conditions
  const requestIdRef = useRef(0);

  const execute = useCallback(
    async (config?: AxiosRequestConfig): Promise<T | null> => {
      const currentRequestId = ++requestIdRef.current;
      const mergedConfig = { ...defaultConfig, ...config };

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        fieldErrors: null,
      }));

      try {
        const response = await api(mergedConfig);
        const responseData = response.data?.data ?? response.data;

        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setState({
            data: responseData as T,
            error: null,
            fieldErrors: null,
            isLoading: false,
          });
        }

        return responseData as T;
      } catch (err) {
        const axiosError = err as AxiosError<ApiErrorResponse>;
        const message =
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An unexpected error occurred';
        const fieldErrors = axiosError.response?.data?.errors || null;

        if (currentRequestId === requestIdRef.current) {
          setState({
            data: null,
            error: message,
            fieldErrors,
            isLoading: false,
          });
        }

        return null;
      }
    },
    [defaultConfig]
  );

  const reset = useCallback(() => {
    requestIdRef.current++;
    setState({
      data: null,
      error: null,
      fieldErrors: null,
      isLoading: false,
    });
  }, []);

  return { ...state, execute, reset };
}
