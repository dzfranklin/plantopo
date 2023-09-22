import {
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { ApiError } from './errors';
import { performApi } from './support';

type ApiQueryOptions<TData, TErrorDetails> = {
  path: Array<string | number>;
  method?: 'GET' | 'POST';
  params?: Record<string, string>;
  body?: unknown;
  mapData?: (data: unknown) => TData;
} & Omit<
  UseQueryOptions<unknown, ApiError<TErrorDetails>, TData, QueryKey>,
  'queryKey' | 'queryFn'
>;

export function useApiQuery<TData, TErrorDetails = unknown>(
  options: ApiQueryOptions<TData, TErrorDetails>,
): UseQueryResult<TData, ApiError<TErrorDetails>> {
  const { path, method, params, body, mapData, ...otherOpts } = options;
  return useQuery<unknown, ApiError<TErrorDetails>, TData, QueryKey>({
    ...otherOpts,
    queryKey: apiQueryKey(options),
    queryFn: async () => {
      const raw = await performApi(method ?? 'GET', path, params, body);
      return mapData ? mapData(raw) : raw;
    },
  });
}

export function apiQueryKey<TData, TErrorDetails = unknown>({
  path,
  params,
  body,
}: ApiQueryOptions<TData, TErrorDetails>): unknown[] {
  const queryKey: unknown[] = [...path];
  if (params) {
    queryKey.push(params);
  }
  if (body) {
    queryKey.push(body);
  }
  return queryKey;
}
