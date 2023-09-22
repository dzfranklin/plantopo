import { MapMeta, usePutMapAccessMutation } from '../api/mapMeta';
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Heading,
  ProgressCircle,
} from '@adobe/react-spectrum';
import { InlineErrorComponent } from '@/generic/InlineErrorComponent';
import { useMapAccess } from '../api/mapMeta';
import { PutMapAccessRequest } from '../api/MapAccess';
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
  const mutation = usePutMapAccessMutation(item.id, {
    onSuccess: close,
  });

  const [changes, setChanges] = useState<PutMapAccessRequest>({});
  const hasChanges = Object.keys(changes).length > 0;
  const onSave = () => {
    if (!hasChanges) close();
    mutation.mutate(changes);
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
        {query.isError && <InlineErrorComponent error={query.error} />}
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
                changes={changes.userAccess || {}}
                setChanges={(userAccess) =>
                  setChanges((p) => ({ ...p, userAccess }))
                }
                isDisabled={mutation.isLoading}
              />
            </section>

            <section>
              <h3 className="pb-2 text-lg font-semibold">General access</h3>
              <GeneralAccessPicker
                level={
                  changes.generalAccessLevel || query.data.generalAccessLevel
                }
                role={changes.generalAccessRole || query.data.generalAccessRole}
                setLevel={(generalAccessLevel) =>
                  setChanges((p) => ({ ...p, generalAccessLevel }))
                }
                setRole={(generalAccessRole) =>
                  setChanges((p) => ({ ...p, generalAccessRole }))
                }
                isDisabled={mutation.isLoading}
              />
            </section>
          </div>
        )}
      </Content>
      <ButtonGroup>
        <p className="self-center mr-4 text-sm italic leading-tight">
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
