import { TrackUpdate } from '@/features/tracks/schema';
import { Dispatch } from 'react';
import Skeleton from '@/components/Skeleton';
import { clsx } from 'clsx';
import * as Headless from '@headlessui/react';
import { Markdown } from '@/components/Markdown';
import { useTrackQuery } from '@/features/tracks/queries';

export function TrackDescription({
  id,
  edit,
  updateEdit,
}: {
  id: string;
  edit?: TrackUpdate | null;
  updateEdit?: Dispatch<TrackUpdate>;
}) {
  const query = useTrackQuery(id);

  if (!query.data) return <Skeleton height="8rem" />;

  const descriptionMd = edit?.descriptionMd ?? query.data.track.descriptionMd;

  if (edit && updateEdit) {
    return (
      <span
        data-slot="control"
        className={clsx([
          // Basic layout
          'relative block w-full max-w-3xl',
          // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
          'before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow',
          // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
          '',
          // Focus ring
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-inset after:ring-transparent sm:after:focus-within:ring-2 sm:after:focus-within:ring-blue-500',
          // Disabled state
          'has-[[data-disabled]]:opacity-50 before:has-[[data-disabled]]:bg-zinc-950/5 before:has-[[data-disabled]]:shadow-none',
        ])}
      >
        <Headless.Textarea
          value={descriptionMd ?? ''}
          placeholder="Description"
          onChange={(e) => updateEdit({ descriptionMd: e.target.value })}
          rows={8}
          className={clsx([
            // Basic layout
            'relative block h-full w-full appearance-none rounded-lg px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]',
            // Typography
            'text-base/6 text-zinc-950 placeholder:text-zinc-500',
            // Border
            'border border-zinc-950/10 data-[hover]:border-zinc-950/20 ',
            // Background color
            'bg-transparent',
            // Hide default focus styles
            'focus:outline-none',
            // Invalid state
            'data-[invalid]:border-red-500 data-[invalid]:data-[hover]:border-red-500 data-[invalid]:data-[invalid]:data-[hover]:',
            // Disabled state
            'disabled:border-zinc-950/20 disabled:disabled:',
            // Resizable
            'resize-y',
          ])}
        />
      </span>
    );
  } else {
    return (
      <Markdown
        className="prose leading-normal max-w-3xl"
        markdown={descriptionMd ?? ''}
      />
    );
  }
}
