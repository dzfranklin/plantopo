'use client';

import { useEffect } from 'react';

export function PageTitle({
  title,
  actions,
}: {
  title?: string;
  actions: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.title;
    if (title) {
      document.title = `${title.trim()} · PlanTopo`;
    } else {
      document.title = 'PlanTopo';
    }
    return () => {
      document.title = prev;
    };
  }, [title]);

  if (title) {
    return (
      <h1 className="mb-8 flex items-baseline">
        <span>
          <span className="text-2xl font-semibold">{title}</span>
        </span>
        <div className="ml-auto flex gap-2">{actions}</div>
      </h1>
    );
  }
}
