import { Dialog } from '@/components/dialog';
import { TracksUploadControl } from '@/features/tracks/upload/TracksUploadControl';

export default function TrackUploadDialog({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <Dialog open={isOpen} onClose={close}>
      <Dialog.Title>Upload tracks</Dialog.Title>
      <Dialog.Body>
        <TracksUploadControl onDone={() => close()} />
      </Dialog.Body>
    </Dialog>
  );
}
