import { AuthorizationError } from '@/api_to_remove';
import { fetchUnitSettings } from './serverApi';
import { UnitSettingsClientProvider } from './useUnitSettings';
import { UnitSettings } from './schema';

export async function UnitSettingsProvider(props: {
  children: React.ReactNode;
}) {
  let initialValue: UnitSettings | null = null;
  try {
    initialValue = await fetchUnitSettings();
  } catch (err) {
    if (err instanceof AuthorizationError) {
      // use default
    } else {
      // TODO: fixme
      // throw err;
    }
  }

  return <UnitSettingsClientProvider initialValue={initialValue} {...props} />;
}
