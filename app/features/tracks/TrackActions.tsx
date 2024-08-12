'use client';

import { Button } from '@/components/button';
import { Track } from '@/features/tracks/api';
import { deleteTrack } from '@/features/tracks/api';
import { usePrompt } from '@/hooks/usePrompt';
import { useRouter } from 'next/navigation';

export default function TrackActions({ track }: { track: Track }) {
  const router = useRouter();
  const prompt = usePrompt();
  return (
    <>
      <Button
        onClick={async () => {
          const confirmed = await prompt.confirm(
            `Are you sure you want to delete ${track.name || ' this unnamed track'}?`,
          );
          if (!confirmed) {
            return;
          }

          await deleteTrack(track.id);
          router.replace('/tracks');
        }}
      >
        Delete
      </Button>
    </>
  );
}
