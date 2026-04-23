import { Section } from "./Section";
import { useUserPrefs, useUserPrefsMutation } from "@/auth/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function SettingsInterfacePage() {
  usePageTitle("Interface settings");

  const prefs = useUserPrefs();
  const mutation = useUserPrefsMutation();

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <Section title="Units">
        <div className="flex items-center gap-4">
          <label className="text-sm" htmlFor="distance-unit">
            Distance
          </label>
          <Select
            value={prefs.distanceUnit}
            onValueChange={value =>
              mutation.mutate({
                ...prefs,
                distanceUnit: value as "km" | "mi",
              })
            }>
            <SelectTrigger id="distance-unit" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Kilometres</SelectItem>
              <SelectItem value="mi">Miles</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mutation.isError && (
          <p className="text-destructive mt-2 text-xs">
            {mutation.error?.message ?? "Failed to save preferences"}
          </p>
        )}
      </Section>
    </div>
  );
}
