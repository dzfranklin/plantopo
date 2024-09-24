'use client';

import { Button } from '@/components/button';
import { useState } from 'react';
import { Dialog } from '@/components/dialog';
import { TracksUploadControl } from '@/features/tracks/upload/TracksUploadControl';

export function PageActions() {
  const [showImport, setShowImport] = useState(false);
  return (
    <>
      <Button onClick={() => setShowImport(true)} color="dark/zinc">
        Import
      </Button>
      <Dialog open={showImport} onClose={() => setShowImport(false)} size="xl">
        <Dialog.Title>Import tracks</Dialog.Title>
        <Dialog.Body>
          <TracksUploadControl onDone={() => setShowImport(false)} />
        </Dialog.Body>
      </Dialog>
    </>
  );
}
