import { usePageTitle } from "./usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Not Found");
  return (
    <div>
      <h1>Page not found</h1>
    </div>
  );
}
