import { Dialog } from '@/components/dialog';
import UnitSettingsForm from './UnitSettingsForm';

export default function UnitSettingsDialog({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Dialog open={isOpen} onClose={close}>
      <UnitSettingsForm onDone={close} />
    </Dialog>
  );
}
