import { $api } from '@/api/client';
import { components, paths } from '@/api/v1';
import { useQueryClient } from '@tanstack/react-query';

export type Settings = components['schemas']['Settings'];

type GetSettingsOK =
  paths['/settings']['get']['responses']['200']['content']['application/json'];

export function useSettingsMutation() {
  const client = useQueryClient();
  return $api.useMutation('put', '/settings', {
    onMutate: (variables) => {
      client.setQueryData(['get', '/settings', null], (p: GetSettingsOK) => ({
        ...p,
        settings: {
          ...p.settings,
          ...variables.body.settings,
        },
      }));
    },
  });
}

export function useSettingsQuery() {
  return $api.useQuery('get', '/settings');
}

export function useSettings(): Settings {
  const value = useSettingsQuery();
  return value.data?.settings ?? {};
}
