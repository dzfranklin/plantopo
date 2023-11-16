import { AppError, TransportError } from '@/api/errors';
import { ToastQueue } from '@react-spectrum/toast';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

const queryCache = new QueryCache({
  onSuccess: (data, query) => {
    console.log('query success', query, data);
  },
  onError: (err, query) => {
    console.warn('query error', query, err);
  },
});

const mutationCache = new MutationCache({
  onError: (err, query) => {
    console.warn('mutation error', query, err);
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    mutations: {
      onError: (err) => {
        let category = 'unknown error';
        if (err instanceof TransportError) {
          category = 'network error';
        } else if (err instanceof AppError) {
          if (err.code >= 400 && err.code < 500) {
            return;
          }
          category = 'server error: ' + err.message;
        }
        ToastQueue.negative('Failed to save changes: ' + category);
      },
    },
  },
});
