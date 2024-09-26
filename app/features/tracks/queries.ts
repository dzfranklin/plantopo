import { $api, fetchClient } from '@/api/client';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { paths } from '@/api/v1';

// TODO: Refactor when new release of openapi-react-query includes <https://github.com/openapi-ts/openapi-typescript/commit/29bd162dccf441abbb33f07c6158410fd81a85d7>

const trackOptions = (id: string) => ({ params: { path: { id } } });

const trackQueryKey = (id: string) => [
  'get',
  '/tracks/track/{id}',
  trackOptions(id),
];

export function useTrackQuery(id: string) {
  return $api.useQuery('get', '/tracks/track/{id}', trackOptions(id));
}

export function useDeleteTrackMutation() {
  const client = useQueryClient();
  return $api.useMutation('delete', '/tracks/track/{id}', {
    onSuccess: (_data, vars) => {
      client.removeQueries({
        queryKey: trackQueryKey(vars.params.path.id),
      });
      client.invalidateQueries({ queryKey: ['get', '/tracks'] }).then(() => {});
    },
  });
}

export function useUpdateTrackMutation() {
  const client = useQueryClient();
  return $api.useMutation('patch', '/tracks/track/{id}', {
    onSuccess: (data, vars) => {
      client.setQueryData(trackQueryKey(vars.params.path.id), data);
      client.invalidateQueries({ queryKey: ['get', '/tracks'] }).then(() => {});
    },
  });
}

export function useTracksQuery(
  query?: paths['/tracks']['get']['parameters']['query'],
) {
  return $api.useQuery('get', '/tracks', { params: { query } });
}

export function useCreateTrackMutation() {
  const client = useQueryClient();
  return $api.useMutation('post', '/tracks', {
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['get', '/tracks'] }).then(() => {});
    },
  });
}
