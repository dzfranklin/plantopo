'use client';

import { Button } from '@/components/button';
import { useState } from 'react';
import TrackUploadDialog from './TrackUploadDialog';

export default function TrackUploadButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Upload tracks</Button>
      <TrackUploadDialog isOpen={isOpen} close={() => setIsOpen(false)} />
    </>
  );
}
