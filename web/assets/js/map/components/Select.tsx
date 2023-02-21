import { useState } from 'react';
import { nanoid } from 'nanoid';

export interface Props<T> {
  options: T[];
  value?: T;
  valueMap?: (value: T) => { id: string; label: string };
  onChange?: (value: T) => void;
  label?: string;
  className?: string;
}

export default function Select<T>(props: Props<T>) {
  const { className, onChange, label, options } = props;

  const value = props.value || options[0];

  const valueMap =
    props.valueMap || ((v) => ({ id: v.toString(), label: v.toString() }));

  const unmapValue = (id) => options.find((o) => valueMap(o).id === id);

  const [selectId] = useState(() => `input-${nanoid()}`);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-1 text-xs font-medium text-gray-700"
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        className="block w-full py-1 pl-3 text-sm border-gray-300 rounded pr-7 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        value={valueMap(value).id}
        onChange={(e) => onChange && onChange(unmapValue(e.target.value))}
      >
        {options.map((option) => (
          <option key={valueMap(option).id} value={valueMap(option).id}>
            {valueMap(option).label}
          </option>
        ))}
      </select>
    </div>
  );
}
