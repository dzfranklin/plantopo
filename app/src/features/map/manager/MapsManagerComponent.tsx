import {
  Button,
  Content,
  Heading,
  IllustratedMessage,
  Text,
} from '@adobe/react-spectrum';
import { MapsManagerSection } from './MapsManagerSection';
import NewMapIcon from '@spectrum-icons/workflow/Add';
import NoMapsIllustration from '@spectrum-icons/illustrations/File';
import { useMapsOwnedByMe } from '../api/mapList';
import { useMapsSharedWithMe } from '../api/mapList';
import { useCallback } from 'react';
import { useMapCreateMutation } from '../api/useMapCreateMutation';
import { useRouter } from 'next/navigation';

export function MapsManagerComponent() {
  const router = useRouter();
  const ownedQuery = useMapsOwnedByMe();
  const sharedQuery = useMapsSharedWithMe();
  const createMutation = useMapCreateMutation({
    onSuccess: (map) => {
      router.push(`/map?id=${map.id}`);
    },
  });
  const doNew = useCallback(() => createMutation.mutate(), [createMutation]);

  const renderEmptyOwnedByMe = useCallback(
    () => (
      <IllustratedMessage>
        <NoMapsIllustration />
        <Heading>No maps</Heading>
        <Content>
          <p>Get started by creating a new map.</p>
          <div className="py-4">
            <Button variant="accent" onPress={doNew}>
              <NewMapIcon />
              <Text>New map</Text>
            </Button>
          </div>
        </Content>
      </IllustratedMessage>
    ),
    [doNew],
  );

  return (
    <div className="relative flex flex-col w-full h-full max-w-5xl mx-auto gap-14">
      <MapsManagerSection
        title="My Maps"
        headerAction={
          <Button variant="primary" onPress={doNew}>
            <NewMapIcon />
            <Text>
              {createMutation.isLoading || createMutation.isSuccess
                ? 'Creating...'
                : 'New map'}
            </Text>
          </Button>
        }
        query={ownedQuery}
        renderEmptyState={renderEmptyOwnedByMe}
      />

      <MapsManagerSection
        title="Shared with me"
        query={sharedQuery}
        renderEmptyState={renderEmptySharedWithMe}
      />
    </div>
  );
}

function renderEmptySharedWithMe() {
  return (
    <IllustratedMessage>
      <NoMapsIllustration />
      <Heading>No maps</Heading>
      <Content>No maps are shared with you yet.</Content>
    </IllustratedMessage>
  );
}
