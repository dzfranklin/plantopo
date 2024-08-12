export default function EmptyStateComponent({
  onClick,
  label,
  secondaryLabel,
  icon,
}: {
  onClick?: () => void;
  label?: string;
  secondaryLabel?: string;
  icon?: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center justify-center h-full">
      <button
        onClick={() => onClick?.()}
        type="button"
        className="relative block w-full max-w-2xl rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {Icon && (
          <Icon
            className="mx-auto h-12 w-12 text-gray-400"
            aria-hidden="true"
          />
        )}

        {label && (
          <h3 className="mt-4 text-sm font-semibold text-gray-900">{label}</h3>
        )}

        {secondaryLabel && (
          <p className="mt-1 text-sm text-gray-500">{secondaryLabel}</p>
        )}
      </button>
    </div>
  );
}
