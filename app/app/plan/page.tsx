'use client';

import { PlanEditor } from './PlanEditor';
import { PageTitle } from '@/components/PageTitle';

export default function Page() {
  return (
    <>
      <PageTitle inlineTitle={false} title={'Edit plan'} />
      <PlanEditor />
    </>
  );
}
