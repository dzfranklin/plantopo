import { useEffect } from 'react';

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title.trim()} · PlanTopo`;
    return () => {
      document.title = prev;
    };
  }, [title]);
  return <></>;
}
