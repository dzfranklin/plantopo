import { Layout } from '@/components/Layout';
import { SettingsForm } from '@/features/settings/SettingsForm';

export default function Page() {
  return (
    <Layout pageTitle="Settings">
      <SettingsForm />
    </Layout>
  );
}
