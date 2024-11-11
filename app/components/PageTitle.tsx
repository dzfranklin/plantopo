'use client';

import { useEffect } from 'react';

export function PageTitle({
  title,
  actions,
  inlineTitle,
}: {
  title?: string;
  actions?: React.ReactNode;
  inlineTitle?: boolean;
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

  if (title && (inlineTitle ?? true)) {
    return (
      <div className="mb-8 flex flex-col md:flex-row gap-2 items-baseline">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="md:ml-auto flex gap-2">{actions}</div>
      </div>
    );
  }
}
