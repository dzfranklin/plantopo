import { RiAddLine, RiDeleteBinLine, RiPencilLine } from "@remixicon/react";
import { VisuallyHidden } from "radix-ui";
import { useState } from "react";

import { CustomBaseStyleSchema, type UserPrefs } from "@pt/shared";

import { Section } from "./Section";
import { useUserPrefs, useUserPrefsMutation } from "@/auth/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/usePageTitle";

type CustomBaseStyle = UserPrefs["customBaseStylesByName"][string];

function CustomBaseStyleDialog({
  trigger,
  initialName,
  initialJson,
  existingNames,
  onSave,
}: {
  trigger: React.ReactNode;
  initialName?: string;
  initialJson?: string;
  existingNames: string[];
  onSave: (name: string, style: CustomBaseStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [json, setJson] = useState(initialJson ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(initialName ?? "");
      setJson(initialJson ?? "");
      setError(null);
    }
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName !== initialName && existingNames.includes(trimmedName)) {
      setError("A style with that name already exists");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
      setJson(JSON.stringify(parsed, null, 2));
    } catch {
      setError("Invalid JSON");
      return;
    }

    const result = CustomBaseStyleSchema.safeParse(parsed);
    if (!result.success) {
      setError(result.error.issues.map(i => i.message).join(", "));
      return;
    }

    onSave(trimmedName, result.data);
    setOpen(false);
  }

  const isEditing = initialName !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit custom base style" : "Add custom base style"}
          </DialogTitle>
          <DialogDescription>
            <VisuallyHidden.Root>
              Enter a unique name and a raster tile source JSON body.
            </VisuallyHidden.Root>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="style-name">
              Name
            </label>
            <Input
              id="style-name"
              autoComplete="off"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My style"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" htmlFor="style-json">
              Raster tile source (
              <a
                href="https://maplibre.org/maplibre-style-spec/sources/#raster"
                className="link"
                target="_blank"
                tabIndex={-1}>
                spec
              </a>
              ).
            </label>
            <textarea
              id="style-json"
              value={json}
              onChange={e => setJson(e.target.value)}
              placeholder={
                '{\n  "type": "raster",\n  "tiles": ["https://..."]\n}'
              }
              rows={8}
              required
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={!name.trim() || !json.trim()}>
              {isEditing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsInterfacePage() {
  usePageTitle("Interface settings");

  const prefs = useUserPrefs();
  const mutation = useUserPrefsMutation();

  function removeStyle(name: string) {
    const next = { ...prefs.customBaseStylesByName };
    delete next[name];
    mutation.mutate({ ...prefs, customBaseStylesByName: next });
  }

  function saveStyle(
    originalName: string | undefined,
    name: string,
    style: CustomBaseStyle,
  ) {
    const next = { ...prefs.customBaseStylesByName };
    if (originalName !== undefined && originalName !== name) {
      delete next[originalName];
    }
    next[name] = style;
    mutation.mutate({ ...prefs, customBaseStylesByName: next });
  }

  const styleEntries = Object.entries(prefs.customBaseStylesByName);
  const styleNames = styleEntries.map(([n]) => n);

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

      <Section title="Custom base styles">
        {styleEntries.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {styleEntries.map(([name, style]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-4 text-sm text-gray-600">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="truncate text-xs text-gray-400">
                    {JSON.stringify(style)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CustomBaseStyleDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        <RiPencilLine className="h-4 w-4" />
                      </Button>
                    }
                    initialName={name}
                    initialJson={JSON.stringify(style, null, 2)}
                    existingNames={styleNames}
                    onSave={(newName, newStyle) =>
                      saveStyle(name, newName, newStyle)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStyle(name)}
                    disabled={mutation.isPending}>
                    <RiDeleteBinLine className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CustomBaseStyleDialog
          trigger={
            <Button variant="outline" size="sm">
              <RiAddLine className="h-4 w-4" />
              Add base style
            </Button>
          }
          existingNames={styleNames}
          onSave={(name, style) => saveStyle(undefined, name, style)}
        />
        {mutation.isError && (
          <p className="text-destructive mt-2 text-xs">
            {mutation.error?.message ?? "Failed to save preferences"}
          </p>
        )}
      </Section>
    </div>
  );
}
