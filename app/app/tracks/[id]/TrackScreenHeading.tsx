import { Button } from '@/components/button';
import Skeleton from '@/components/Skeleton';
import { TrackUpdate } from '@/features/tracks/schema';
import { useRouter } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { Dispatch } from 'react';
import { clsx } from 'clsx';
import * as Headless from '@headlessui/react';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '@/components/dropdown';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import {
  useDeleteTrackMutation,
  useTrackQuery,
  useUpdateTrackMutation,
} from '@/features/tracks/queries';

export function TrackScreenHeading({
  id,
  edit,
  updateEdit,
  endEdit,
}: {
  id: string;
  edit: TrackUpdate | null;
  updateEdit: Dispatch<TrackUpdate>;
  endEdit: Dispatch<void>;
}) {
  const router = useRouter();
  const prompt = usePrompt();

  const query = useTrackQuery(id);
  const updateMutation = useUpdateTrackMutation();
  const deleteMutation = useDeleteTrackMutation();

  return (
    <div className="mt-2 md:flex md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <TitleComponent id={id} edit={edit} updateEdit={updateEdit} />
      </div>

      <div className="mt-4 flex items-baseline flex-shrink-0 md:ml-4 md:mt-0 gap-2">
        {edit ? (
          <>
            <Button onClick={() => endEdit()}>Cancel</Button>
            <Button
              color="primary"
              disabled={Object.keys(edit).length === 0}
              disableWith={updateMutation.isPending && 'Saving...'}
              onClick={() => {
                updateMutation.mutate(
                  {
                    params: { path: { id } },
                    body: {
                      track: edit,
                    },
                  },
                  {
                    onSuccess: () => endEdit(),
                  },
                );
              }}
            >
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => updateEdit({})}>Edit</Button>
          </>
        )}

        <Dropdown>
          <div>
            <DropdownButton>
              Options
              <ChevronDownIcon
                aria-hidden="true"
                className="-mr-1 h-5 w-5 text-gray-400"
              />
            </DropdownButton>
          </div>

          <DropdownMenu>
            <DropdownItem
              onClick={async () => {
                const confirmed = await prompt.confirm(
                  `Are you sure you want to delete ${query.data?.track?.name || ' this track'}?`,
                );
                if (!confirmed) {
                  return;
                }

                deleteMutation.mutate(
                  { params: { path: { id } } },
                  { onSuccess: () => router.replace('/tracks') },
                );
              }}
            >
              Delete
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  );
}

function TitleComponent({
  id,
  edit,
  updateEdit,
}: {
  id: string;
  edit: TrackUpdate | null;
  updateEdit: Dispatch<TrackUpdate>;
}) {
  const query = useTrackQuery(id);

  if (!query.data) return <Skeleton height="3.5rem" width="40rem" />;

  let name = query.data.track.name ?? 'Unnamed track';

  if (edit) {
    name = edit.name ?? name;
    return (
      <span
        data-slot="control"
        className={clsx([
          // Basic layout
          'relative block w-full rounded-lg',
          // Background color + shadow applied to inset pseudo-element, so shadow blends with border in light mode
          'before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow',
          // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
          '',
          // Focus ring
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-inset after:ring-transparent sm:after:focus-within:ring-2 sm:after:focus-within:ring-blue-500',
          // Disabled state
          'has-[[data-disabled]]:opacity-50 before:has-[[data-disabled]]:bg-zinc-950/5 before:has-[[data-disabled]]:shadow-none',
          // Invalid state
          'before:has-[[data-invalid]]:shadow-red-500/10',
        ])}
      >
        <Headless.Input
          value={name}
          onChange={(e) => updateEdit({ name: e.target.value })}
          className={clsx([
            // Basic layout
            'relative block w-full appearance-none rounded-lg px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing[3])-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]',
            // Typography
            'text-xl font-bold leading-7 text-gray-900 placeholder:text-gray-900 sm:truncate sm:text-2xl sm:tracking-tight',
            // Border
            'border border-zinc-950/10 data-[hover]:border-zinc-950/20 ',
            // Background color
            'bg-transparent ',
            // Hide default focus styles
            'focus:outline-none',
            // Invalid state
            'data-[invalid]:border-red-500 data-[invalid]:data-[hover]:border-red-500 data-[invalid]:data-[invalid]:data-[hover]:',
            // Disabled state
            'data-[disabled]:border-zinc-950/20 data-[disabled]:data-[disabled]:',
          ])}
        />
      </span>
    );
  } else {
    return (
      <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
        {name}
      </h1>
    );
  }
}
