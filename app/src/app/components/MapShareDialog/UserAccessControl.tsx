import { User } from '@/api/account/User';
import {
  PendingInvite,
  PutUserAccessEntry,
  UserAccessEntry,
} from '@/api/map/MapAccess';
import cls from '@/app/cls';
import { useCurrentUser } from '@/app/useCurrentUser';
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
  changes: Record<number, PutUserAccessEntry>;
  setChanges: (changes: Record<number, PutUserAccessEntry>) => any;
  isDisabled: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      <EntryContainer>
        <EntryUserName entry={owner} />
        <EntryEmail entry={owner} />
        <div className="row-span-2 pr-2 text-neutral-600 text-md text-right">
          Owner
        </div>
      </EntryContainer>

      {current.map((entry) => (
        <AccessEntry
          key={`current-${entry.id}`}
          isDisabled={isDisabled}
          entry={entry}
          change={changes[entry.id]}
          setChange={(change) => setChanges({ ...changes, [entry.id]: change })}
        />
      ))}

      {pending.map((entry) => (
        <EntryContainer key={`pending-${entry.email}`}>
          <div className="font-semibold text-md">{entry.email}</div>
          <div className="row-span-2 pr-2 text-neutral-600 text-md text-right">
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
      <EntryUserName entry={entry} />
      <EntryEmail entry={entry} />
      <div className="row-span-2 flex justify-end">
        <Picker
          isDisabled={isDisabled}
          selectedKey={change ? change.role ?? 'remove' : entry.role}
          onSelectionChange={(key) => {
            let role: PutUserAccessEntry['role'];
            if (key === 'remove') role = null;
            else if (key === 'viewer' || key === 'editor') role = key;
            else throw new Error('Unreachable');
            setChange?.({ id: entry.id, role });
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

function EntryUserName({ entry }: { entry: User }) {
  const currentUser = useCurrentUser();
  const isYou = currentUser?.id === entry.id;
  return (
    <span className="font-semibold text-md">
      {entry.name}
      {isYou && ' (You)'}
    </span>
  );
}

function EntryEmail({ entry }: { entry: User }) {
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
