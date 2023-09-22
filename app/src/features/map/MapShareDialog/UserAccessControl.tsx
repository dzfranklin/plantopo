import { User } from '@/features/account/api/User';
import { useSession } from '@/features/account/session';
import {
  PendingInvite,
  PutUserAccessEntry,
  UserAccessEntry,
} from '@/features/map/api/MapAccess';
import cls from '@/generic/cls';
import { Item, Section, Picker } from '@adobe/react-spectrum';
import { ReactNode } from 'react';

export function UserAccessControl({
  owner,
  current,
  pending,
  changes,
  setChanges,
  isDisabled,
}: {
  owner: User;
  current: UserAccessEntry[];
  pending: PendingInvite[];
  changes: Record<string, PutUserAccessEntry>; // by userId
  setChanges: (changes: Record<string, PutUserAccessEntry>) => any;
  isDisabled: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      <EntryContainer>
        <EntryUserName user={owner} />
        <EntryEmail user={owner} />
        <div className="row-span-2 pr-2 text-right text-neutral-600 text-md">
          Owner
        </div>
      </EntryContainer>

      {current.map((entry) => (
        <AccessEntry
          key={`current-${entry.user.id}`}
          isDisabled={isDisabled}
          entry={entry}
          change={changes[entry.user.id]}
          setChange={(change) =>
            setChanges({ ...changes, [entry.user.id]: change })
          }
        />
      ))}

      {pending.map((entry) => (
        <EntryContainer key={`pending-${entry.email}`}>
          <div className="font-semibold text-md">{entry.email}</div>
          <div className="row-span-2 pr-2 text-right text-neutral-600 text-md">
            Invite sent
          </div>
        </EntryContainer>
      ))}
    </ul>
  );
}

function AccessEntry({
  entry,
  change,
  isDisabled,
  setChange,
}: {
  entry: UserAccessEntry;
  change: PutUserAccessEntry | undefined;
  isDisabled: boolean;
  setChange: (_: PutUserAccessEntry) => any;
}) {
  return (
    <EntryContainer>
      <EntryUserName user={entry.user} />
      <EntryEmail user={entry.user} />
      <div className="flex justify-end row-span-2">
        <Picker
          isDisabled={isDisabled}
          selectedKey={
            change ? ('delete' in change ? 'remove' : change.role) : entry.role
          }
          onSelectionChange={(key) => {
            switch (key) {
              case 'remove':
                setChange?.({ delete: true });
                break;
              case 'viewer':
              case 'editor':
                setChange?.({ role: key });
                break;
              default:
                throw new Error('Unreachable');
            }
          }}
          gridRow="-1 / 1"
          aria-label="role"
          isQuiet
          width="min-content"
        >
          <Item key="viewer">Viewer</Item>
          <Item key="editor">Editor</Item>
          <Section>
            <Item key="remove">Remove access</Item>
          </Section>
        </Picker>
      </div>
    </EntryContainer>
  );
}

function EntryUserName({ user: entry }: { user: User }) {
  const session = useSession();
  const isYou = session && session.user.id === entry.id;
  return (
    <span className="font-semibold text-md">
      {entry.fullName}
      {isYou && ' (You)'}
    </span>
  );
}

function EntryEmail({ user: entry }: { user: User }) {
  return (
    <span className="row-start-2 text-sm leading-tight">{entry.email}</span>
  );
}

function EntryContainer({ children }: { children: ReactNode }) {
  return (
    <li
      className={cls(
        'grid items-center py-2 px-3 rounded-sm',
        'grid-cols-[minmax(0,1fr)_10em] grid-rows-[minmax(0,1fr)_min-content]',
        'hover:bg-neutral-200 bg-opacity-40',
      )}
    >
      {children}
    </li>
  );
}
