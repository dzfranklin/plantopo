'use client';

import { AppError } from '@/api/errors';
import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import {
  useMaybeMapMeta,
  useRequestMapAccessMutation,
} from '@/features/map/api/mapMeta';
import { Button, Item, Picker, ProgressBar } from '@adobe/react-spectrum';
import { notFound, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';

export default function RequestAccessPage() {
  const session = useSession({ require: true });
  const params = useSearchParams();
  const mapId = params?.get('mapId') ?? notFound();
  const meta = useMaybeMapMeta(mapId);

  if (!session) {
    // we're about to be redirected
    return;
  }

  if (meta.error) {
    if (!(meta.error instanceof AppError)) {
      throw meta.error;
    }
    if (meta.error.code === 404) {
      notFound();
    }
    if (meta.error.code !== 401 && meta.error.code !== 403) {
      throw meta.error;
    }
  }

  if (meta.isLoading) {
    return (
      <Layout pageTitle="Request map access">
        <ProgressBar isIndeterminate label="Loading..." />
      </Layout>
    );
  }

  let pageTitle = 'Request access';
  if (meta.data && !meta.data.currentSessionMayEdit) {
    pageTitle = `Request edit access to "${meta.data.name}"`;
  } else if (!meta.data) {
    pageTitle = `You don't have permission to access this map`;
  }

  return (
    <Layout pageTitle={pageTitle}>
      {meta.data && meta.data.currentSessionMayEdit && (
        <div className="p-4 border-l-4 border-green-400 bg-green-50">
          <div className="ml-3">
            <p className="text-sm text-green-700">
              You already have edit access.{' '}
              <a
                href={`/map/${mapId}`}
                className="font-medium text-green-700 underline hover:text-green-600"
              >
                Return to map
              </a>
            </p>
          </div>
        </div>
      )}

      {meta.data && !meta.data.currentSessionMayEdit && (
        <div>
          <div className="p-4 mb-8 border-l-4 border-blue-400 bg-blue-50">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                You already have view access.
              </p>
            </div>
          </div>
          <RequestAccessComponent mapId={mapId} alreadyViewer={true} />
        </div>
      )}

      {!meta.data && (
        <RequestAccessComponent mapId={mapId} alreadyViewer={false} />
      )}
    </Layout>
  );
}

function RequestAccessComponent({
  mapId,
  alreadyViewer,
}: {
  mapId: string;
  alreadyViewer: boolean;
}) {
  const messageInput = useId();
  const [requestedRole, setRequestedRole] = useState<'viewer' | 'editor'>(
    'editor',
  );
  const [message, setMessage] = useState('');
  const mutation = useRequestMapAccessMutation(mapId);
  if (mutation.error) throw mutation.error;
  if (mutation.isSuccess) {
    return (
      <div className="p-4 border-l-4 border-green-400 bg-green-50">
        <div className="ml-3">
          <p className="text-sm text-green-700">Request sent.</p>
        </div>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evt) => {
        evt.preventDefault();
        if (mutation.isLoading) return;
        mutation.mutate({
          requestedRole,
          message: message.length > 0 ? message : undefined,
        });
      }}
    >
      <h3 className="mb-4 text-base font-semibold leading-6 text-gray-900">
        You can ask the owner of the map for{' '}
        {alreadyViewer ? <span>edit access</span> : <span>access</span>}
      </h3>

      <Picker
        selectedKey={alreadyViewer ? 'editor' : requestedRole}
        disabledKeys={alreadyViewer ? ['viewer'] : []}
        onSelectionChange={(key) => {
          if (key !== 'viewer' && key !== 'editor') {
            throw new Error('Unreachable');
          }
          setRequestedRole(key);
        }}
        aria-label="role"
        menuWidth="8em"
        width="min-content"
        isQuiet
        label="Requested role"
      >
        <Item key="viewer">Viewer</Item>
        <Item key="editor">Editor</Item>
      </Picker>

      <div>
        <label
          htmlFor={messageInput}
          className="block text-xs leading-6 text-gray-700"
        >
          Message
        </label>
        <div className="mt-2">
          <textarea
            id={messageInput}
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
            value={message}
            onChange={(evt) => setMessage(evt.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <Button variant="accent" type="submit" isDisabled={mutation.isLoading}>
          Send request
        </Button>
      </div>
    </form>
  );
}
