import { MapMeta } from '@/api/map/MapMeta';
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Heading,
  ProgressCircle,
} from '@adobe/react-spectrum';
import { InlineErrorComponent } from '../InlineErrorComponent';
import { useMapAccess } from '@/api/map/useMapAccess';
import { useSetMapSharingMutation } from '@/api/map/useSetMapSharingMutation';
import {
  PutMapAccess,
  GeneralAccessLevel,
  GeneralAccessRole,
  PutUserAccessEntry,
} from '@/api/map/MapAccess';
import { useState } from 'react';
import { GeneralAccessPicker } from '../GeneralAccessPicker';
import { UserAccessControl } from './UserAccessControl';
import { UserInviteControl } from './UserInviteControl';

export function MapShareDialog({
  item,
  close,
}: {
  item: MapMeta;
  close: () => void;
}) {
  const query = useMapAccess(item.id);
  const mutation = useSetMapSharingMutation(item.id, {
    onSuccess: close,
  });

  const [newGenAccessLevel, setNewGenAccessLevel] =
    useState<GeneralAccessLevel | null>(null);
  const [newGenAccessRole, setNewGenAccessRole] =
    useState<GeneralAccessRole | null>(null);
  const [newUserAccess, setNewUserAccess] = useState<
    Record<number, PutUserAccessEntry>
  >({});
  const hasChanges =
    newGenAccessLevel !== null ||
    newGenAccessRole !== null ||
    Object.keys(newUserAccess).length > 0;

  const onSave = () => {
    if (!hasChanges) close();

    const props: Omit<PutMapAccess, 'id'> = {};
    if (newGenAccessLevel) props.generalAccessLevel = newGenAccessLevel;
    if (newGenAccessRole) props.generalAccessRole = newGenAccessRole;
    props.userAccess = Object.values(newUserAccess);
    mutation.mutate(props);
  };

  return (
    <Dialog>
      <Heading marginBottom="1.25rem">
        Share &quot;{item.name || 'Unnamed map'}&quot;
      </Heading>
      <Content>
        {mutation.isError && <InlineErrorComponent error={mutation.error} />}
        {query.isLoading && (
          <ProgressCircle isIndeterminate aria-label="loading" size="M" />
        )}
        {query.isSuccess && (
          <div className="flex flex-col gap-6 pt-1 pb-1">
            <section>
              <h3 className="pb-2 text-lg font-semibold">Invite people</h3>
              <UserInviteControl map={item.id} />
            </section>

            <section>
              <h3 className="pb-2 text-lg font-semibold">People with access</h3>
              <UserAccessControl
                owner={query.data.owner}
                current={query.data.userAccess}
                pending={query.data.pendingInvites}
                changes={newUserAccess}
                setChanges={setNewUserAccess}
                isDisabled={mutation.isLoading}
              />
            </section>

            <section>
              <h3 className="pb-2 text-lg font-semibold">General access</h3>
              <GeneralAccessPicker
                level={newGenAccessLevel || query.data.generalAccessLevel}
                role={newGenAccessRole || query.data.generalAccessRole}
                setLevel={setNewGenAccessLevel}
                setRole={setNewGenAccessRole}
                isDisabled={mutation.isLoading}
              />
            </section>
          </div>
        )}
      </Content>
      <ButtonGroup>
        <p className="text-sm leading-tight italic self-center mr-4">
          {hasChanges && 'Pending changes'}
        </p>

        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button
          variant="accent"
          onPress={onSave}
          isDisabled={mutation.isLoading || query.isLoading}
        >
          {hasChanges ? (mutation.isLoading ? 'Saving...' : 'Save') : 'Done'}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}
