import { FolderIcon } from '@heroicons/react/24/solid';
import { useRef } from 'react';
import cls from '@/cls';

const inDragClass = 'bg-gray-100';

/**
 * Params:
 * - icon: A @heroicons/react/24/solid would be suitable
 */
export default function FileUpload({
  restrictionsLabel,
  icon,
  ...inputProps
}: {
  restrictionsLabel?: string;
  icon?: (_: React.SVGProps<SVGSVGElement>) => React.ReactElement;
} & Omit<React.HTMLProps<HTMLInputElement>, 'className'>) {
  const IconComponent = icon || FolderIcon;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <label
      onDrop={(evt) => {
        evt.currentTarget.classList.remove(inDragClass);
      }}
      onDragEnter={(evt) => {
        evt.currentTarget.classList.add(inDragClass);
      }}
      onDragExit={(evt) => {
        evt.currentTarget.classList.remove(inDragClass);
      }}
      className={cls(
        'relative mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 cursor-pointer',
        'hover:bg-gray-100',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2',
      )}
    >
      <input
        {...inputProps}
        ref={inputRef}
        type="file"
        className="absolute inset-0 opacity-0"
      />

      <div className="text-center">
        <IconComponent
          className="mx-auto h-12 w-12 text-gray-300"
          aria-hidden="true"
        />

        <div className="mt-4 flex text-sm leading-6 text-gray-600">
          <span className="font-semibold text-indigo-600 hover:text-indigo-500">
            Upload {inputProps.multiple ? 'files' : 'a file'}
          </span>
          <p className="pl-1">or drag and drop</p>
        </div>
        {restrictionsLabel && (
          <p className="text-xs leading-5 text-gray-600">{restrictionsLabel}</p>
        )}
      </div>
    </label>
  );
}
