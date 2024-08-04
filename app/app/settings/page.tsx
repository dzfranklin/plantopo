import { Layout } from '@/components/Layout';
import UnitSettingsForm from '@/features/units/UnitSettingsForm';

export default function Page() {
  return (
    <Layout pageTitle="Settings">
      <div className="w-full max-w-3xl space-y-6">
        <UnitSettingsForm />
      </div>
    </Layout>
  );
}
