export default function Skeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="status"
      className="w-full h-full flex items-center justify-center bg-gray-300 rounded-lg animate-pulse"
    >
      <span className="sr-only">Loading...</span>
      {children}
    </div>
  );
}
