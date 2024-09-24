import { Dialog } from '@/components/dialog';
import {
  useSettingsMutation,
  useSettingsQuery,
} from '@/features/settings/useSettings';
import Skeleton from '@/components/Skeleton';
import { toast } from 'react-hot-toast';
import { Field, Fieldset, Label } from '@/components/fieldset';
import { Select } from '@/components/select';
import { Button } from '@/components/button';

export default function UnitSettingsDialog({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Dialog open={isOpen} onClose={close}>
      <UnitSettingsForm onDone={close} />
    </Dialog>
  );
}

function UnitSettingsForm({ onDone }: { onDone: () => void }) {
  const mutation = useSettingsMutation();
  const query = useSettingsQuery();

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
            onSuccess: () => {
              toast.success('Saved settings');
              onDone();
            },
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

        <div>
          <Button
            type="submit"
            disableWith={mutation.isPending && 'Saving...'}
            color="dark/zinc"
          >
            Save
          </Button>
        </div>
      </Fieldset>
    </form>
  );
}
