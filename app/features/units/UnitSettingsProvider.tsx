import { UnitSettingsClientProvider } from './useUnitSettings';

export function UnitSettingsProvider(props: { children: React.ReactNode }) {
  // let initialValue: UnitSettings | null = null;
  // try {
  //   initialValue = await fetchUnitSettings();
  // } catch (err) {
  //   if (err instanceof AuthorizationError) {
  // use default
  // } else {
  // TODO: fixme
  // throw err;
  // }
  // }

  // return <UnitSettingsClientProvider initialValue={initialValue} {...props} />;
  return <UnitSettingsClientProvider initialValue={null} {...props} />;
}
