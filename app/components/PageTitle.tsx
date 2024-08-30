'use client';

import { useEffect } from 'react';

export function PageTitle({
  title,
  actions,
  inlineTitle,
}: {
  title?: string;
  actions: React.ReactNode;
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
      <h1 className="mb-8 flex items-baseline">
        <span className="text-2xl font-semibold">{title}</span>
        <div className="ml-auto flex gap-2">{actions}</div>
      </h1>
    );
  }
}
