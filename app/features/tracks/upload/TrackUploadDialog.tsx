'use client';

import { Dialog } from '@/components/dialog';
import { useState } from 'react';
import { uploadTracks } from './api';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/button';

export default function TrackUploadDialog({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  const [hasFiles, setHasFiles] = useState(false);
  return (
    <Dialog open={isOpen} onClose={close}>
      <form
        className="space-y-12"
        onChange={(evt) => {
          const input =
            evt.currentTarget.querySelector<HTMLInputElement>('[name=files]');
          setHasFiles(!!input?.files?.length);
        }}
        onSubmit={async (evt) => {
          evt.preventDefault();
          const formData = new FormData(evt.currentTarget);
          const files = formData.getAll('files') as File[];
          const imports = await uploadTracks(files);
          close();
          console.log('imports', imports);
        }}
      >
        <Dialog.Title>Upload tracks</Dialog.Title>
        <Dialog.Body>
          <FileUpload
            multiple={true}
            name="files"
            restrictionsLabel="GPX up to 10MB"
            accept=".gpx,application/gpx+xml"
          />
        </Dialog.Body>

        <Dialog.Actions>
          <Button type="submit" disabled={!hasFiles}>
            Upload
          </Button>
        </Dialog.Actions>
      </form>
    </Dialog>
  );
}
