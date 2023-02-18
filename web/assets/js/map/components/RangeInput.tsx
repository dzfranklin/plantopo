import { nanoid } from "nanoid";
import { useState } from "react";

export interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  pattern?: string;
  placeholder?: string;
  className?: string;
}

export default function RangeInput(props: Props) {
  const [id] = useState(() => `input-${nanoid()}`);

  return (
    <div className={props.className}>
      {props.label && (
        <label
          htmlFor={id}
          className="block mb-1 text-xs font-medium text-gray-700"
        >
          {props.label}
        </label>
      )}

      <div>
        <input
          type="range"
          id={id}
          min={props.min}
          max={props.max}
          value={props.value.toString()}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
