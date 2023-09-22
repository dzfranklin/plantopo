import {
  UseMutationOptions,
  UseMutationResult,
  useMutation,
} from '@tanstack/react-query';
import { ApiError } from './errors';
import { performApi } from './support';

type ApiMutationOptions<TData, TErrorDetails, TVariables> = {
  method?: 'POST' | 'PUT' | 'DELETE';
  path: Array<string | number>;
} & Omit<
  UseMutationOptions<TData, ApiError<TErrorDetails>, TVariables>,
  'mutationKey' | 'mutationFn'
>;

const DEFAULT_METHOD = 'POST';

export function useApiMutation<TData, TErrorDetails, TVariables>(
  options: ApiMutationOptions<TData, TErrorDetails, TVariables>,
): UseMutationResult<TData, ApiError<TErrorDetails>, TVariables> {
  const { method, path, ...otherOpts } = options;
  return useMutation({
    ...otherOpts,
    mutationKey: apiMutationKey(options),
    mutationFn: async (variables) =>
      performApi(method ?? DEFAULT_METHOD, path, {}, variables),
  });
}

export function apiMutationKey<TData, TErrorDetails, TVariables>({
  method,
  path,
}: ApiMutationOptions<TData, TErrorDetails, TVariables>): unknown[] {
  return [method ?? DEFAULT_METHOD, path];
}
