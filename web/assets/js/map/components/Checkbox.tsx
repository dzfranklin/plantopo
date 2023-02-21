import { nanoid } from 'nanoid';
import { useState } from 'react';

interface Props {
  value: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  className?: string;
}

export default function Checkbox({ value, onChange, label, className }: Props) {
  const [inputId] = useState(() => `input-${nanoid()}`);

  return (
    <span className={className}>
      <input
        type="checkbox"
        id={inputId}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && (
        <label
          htmlFor={inputId}
          className="inline-block ml-2 text-xs font-medium text-gray-700"
        >
          {label}
        </label>
      )}
    </span>
  );
}
