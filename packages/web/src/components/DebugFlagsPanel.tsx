import { RiArrowRightSLine } from "@remixicon/react";

import { by0 } from "@pt/shared";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  resetDebugFlags,
  setDebugFlag,
  useDebugFlags,
} from "@/hooks/debug-flags";
import { cn } from "@/util/cn";

export function DebugFlagsPanel({
  collapsible = false,
}: {
  collapsible?: boolean;
}) {
  const flags = useDebugFlags();
  const flagList = Object.entries(flags).sort(by0({ numeric: true }));
  return (
    <Collapsible
      defaultOpen={!collapsible}
      open={collapsible ? undefined : true}
      className="w-full max-w-sm">
      <div className="mb-4 flex justify-between">
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-1 font-bold",
            "[&[data-state=open]>svg]:rotate-90",
            collapsible ? "text-xs" : "text-sm",
          )}>
          {collapsible && (
            <RiArrowRightSLine className="size-4 transition-transform" />
          )}
          Debug Flags
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Button variant="outline" size="sm" onClick={resetDebugFlags}>
            Reset
          </Button>
        </CollapsibleContent>
      </div>
      <CollapsibleContent>
        <FieldGroup className="w-full max-w-sm">
          {flagList.map(([key, value]) => (
            <FieldLabel key={key}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{key}</FieldTitle>
                </FieldContent>
                <Switch
                  checked={value}
                  onCheckedChange={checked =>
                    setDebugFlag(key as keyof typeof flags, checked)
                  }
                />
              </Field>
            </FieldLabel>
          ))}
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}
