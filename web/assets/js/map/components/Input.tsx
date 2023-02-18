import { nanoid } from "nanoid";
import { useState } from "react";

export interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  type?: string;
  pattern?: string;
  placeholder?: string;
  className?: string;
}

export default function Input(props: Props) {
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
          type={props.type || "text"}
          id={id}
          className="block w-full px-2 py-1 text-sm border-gray-300 rounded focus:border-indigo-500 focus:ring-indigo-500"
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
