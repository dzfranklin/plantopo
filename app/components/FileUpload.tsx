import { FolderIcon } from '@heroicons/react/24/solid';

/**
 * Params:
 * - icon: A @heroicons/react/24/solid would be suitable
 */
export default function FileUpload({
  label,
  restrictionsLabel,
  name,
  multiple,
  accept,
  icon,
}: {
  label?: string;
  restrictionsLabel?: string;
  name?: string;
  multiple?: boolean;
  accept?: string;
  icon?: (_: React.SVGProps<SVGSVGElement>) => React.ReactElement;
}) {
  const IconComponent = icon || FolderIcon;
  return (
    <div>
      {label && (
        <label
          htmlFor="cover-photo"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          {label}
        </label>
      )}
      <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
        <div className="text-center">
          <IconComponent
            className="mx-auto h-12 w-12 text-gray-300"
            aria-hidden="true"
          />

          <div className="mt-4 flex text-sm leading-6 text-gray-600">
            <label className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
              <span>Upload {multiple ? 'files' : 'a file'}</span>
              <input
                type="file"
                name={name}
                multiple={!!multiple}
                accept={accept}
                className="sr-only"
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          {restrictionsLabel && (
            <p className="text-xs leading-5 text-gray-600">
              {restrictionsLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
