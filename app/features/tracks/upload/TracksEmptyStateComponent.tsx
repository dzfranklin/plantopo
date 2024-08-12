'use client';

import { FolderIcon } from '@heroicons/react/24/solid';

import EmptyStateComponent from '@/components/EmptyState';
import { useState } from 'react';
import TrackUploadDialog from './TrackUploadDialog';

export default function TracksEmptyStateComponent() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <EmptyStateComponent
        onClick={() => setIsOpen(true)}
        label="No tracks"
        secondaryLabel="Get started by uploading a track"
        icon={FolderIcon}
      />
      <TrackUploadDialog isOpen={isOpen} close={() => setIsOpen(false)} />
    </>
  );
}
