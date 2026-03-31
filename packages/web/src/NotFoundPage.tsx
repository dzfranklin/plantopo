import { usePageTitle } from "./usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Not Found");
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
    </div>
  );
}
