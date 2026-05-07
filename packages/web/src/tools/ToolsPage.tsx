import { RiArrowRightLine } from "@remixicon/react";

import { usePageTitle } from "@/hooks/usePageTitle";

export default function ToolsPage() {
  usePageTitle("Tools");
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Tools</h1>
      <ul>
        <ToolSection title="Import from Strava" link="/strava/import">
          Import your Strava activities.
        </ToolSection>
      </ul>
    </div>
  );
}

function ToolSection({
  title,
  children,
  link,
}: {
  title: string;
  children?: React.ReactNode;
  link: string;
}) {
  return (
    <li className="mb-4">
      <a
        href={link}
        className="link flex items-center justify-between text-lg font-semibold">
        {title} <RiArrowRightLine />
      </a>
      {children && <p className="mt-1">{children}</p>}
    </li>
  );
}
