import cls from '@/cls';

const normalizeSize = (v: string | number) =>
  typeof v === 'string' ? v : v + 'px';

export default function Skeleton({
  children,
  width,
  height,
  inline,
}: {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  inline?: boolean;
}) {
  return (
    <div
      role="status"
      className={cls(
        inline ? 'inline-flex' : 'mx-1 my-4 flex',
        'items-center justify-center bg-gray-300 rounded-lg animate-pulse',
      )}
      style={{
        width: normalizeSize(width ?? '100%'),
        height: normalizeSize(height ?? '100%'),
      }}
    >
      <span className="sr-only">Loading...</span>
      {children}
    </div>
  );
}
