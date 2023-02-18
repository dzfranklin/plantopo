import { Switch } from "@headlessui/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import classNames from "../../classNames";

interface Props {
  value: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  className?: string;
  enabled?: boolean;
}

export default function Toggle({
  value,
  onChange,
  label,
  className,
  enabled,
}: Props) {
  return (
    <Switch
      checked={value}
      onChange={onChange}
      className={classNames(
        "relative inline-flex items-center justify-center flex-shrink-0 w-10 h-5 rounded-full cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute w-full h-full bg-white rounded-md pointer-events-none"
      />
      <span
        aria-hidden="true"
        className={classNames(
          enabled ? "bg-indigo-600" : "bg-gray-200",
          "pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out"
        )}
      />
      <span
        aria-hidden="true"
        className={classNames(
          enabled ? "translate-x-5" : "translate-x-0",
          "pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out"
        )}
      />

      <Switch.Label as="span" className="ml-3">
        <span className="text-sm text-gray-900">{label}</span>
      </Switch.Label>
    </Switch>
  );
}
