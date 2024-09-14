'use client';

import {
  useSettingsMutation,
  useSettingsQuery,
} from '@/features/settings/useSettings';
import { Field, Fieldset, Label } from '@/components/fieldset';
import { Select } from '@/components/select';
import { Button } from '@/components/button';
import { toast } from 'react-hot-toast';
import Skeleton from '@/components/Skeleton';

export function SettingsForm() {
  const mutation = useSettingsMutation();
  const query = useSettingsQuery();

  if (query.error) throw query.error;
  if (!query.data) {
    return <Skeleton />;
  }
  const settings = query.data.settings;

  return (
    <form
      onSubmit={(evt) => {
        evt.preventDefault();
        const form = new FormData(evt.currentTarget);
        mutation.mutate(
          {
            body: {
              settings: {
                units: form.get('units') as 'metric' | 'customary',
              },
            },
          },
          {
            onSuccess: () => toast.success('Saved settings'),
          },
        );
      }}
    >
      <Fieldset className="max-w-sm flex flex-col gap-8">
        <Field>
          <Label>Units</Label>
          <Select name="units" defaultValue={settings.units}>
            <option value="metric">Metric</option>
            <option value="customary">Customary</option>
          </Select>
        </Field>

        <div className="mt-4">
          <Button type="submit" disableWith={mutation.isPending && 'Saving...'}>
            Save
          </Button>
        </div>
      </Fieldset>
    </form>
  );
}
