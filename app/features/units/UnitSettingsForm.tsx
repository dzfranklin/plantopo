'use client';

import { Button } from '@/components/button';
import {
  Field,
  FieldGroup,
  Fieldset,
  Label,
  Legend,
} from '@/components/fieldset';
import { Select } from '@/components/select';
import { useUnitSettings } from './useUnitSettings';
import { UnitSystemSchema } from './schema';
import { toast } from 'react-hot-toast';

export default function UnitSettingsForm({ onDone }: { onDone?: () => void }) {
  const [settings, updateSettings] = useUnitSettings();

  return (
    <form
      className="w-full max-w-sm"
      onSubmit={(evt) => {
        evt.preventDefault();
        const formData = new FormData(evt.currentTarget);
        const distance = UnitSystemSchema.parse(formData.get('distance'));
        const elevation = UnitSystemSchema.parse(formData.get('elevation'));
        updateSettings((p) => ({ ...p, distance, elevation }));
        toast.success('Applied unit settings');
        onDone?.();
      }}
    >
      <Fieldset>
        <FieldGroup>
          <Legend>Unit settings</Legend>

          <Field>
            <Label>Distance</Label>
            <Select name="distance" defaultValue={settings.distance}>
              <option value="metric">Metric</option>
              <option value="customary">Customary</option>
            </Select>
          </Field>

          <Field>
            <Label>Elevation</Label>
            <Select name="elevation" defaultValue={settings.elevation}>
              <option value="metric">Meters</option>
              <option value="customary">Customary</option>
            </Select>
          </Field>

          <div className="mt-8 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto">
            <Button type="submit">Apply</Button>
          </div>
        </FieldGroup>
      </Fieldset>
    </form>
  );
}
