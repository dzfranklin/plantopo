import {
  Button,
  Content,
  Dialog,
  Divider,
  Form,
  Heading,
  Item,
  Picker,
  ProgressBar,
  useDialogContainer,
} from '@adobe/react-spectrum';
import { useState } from 'react';
import { useExportMapMutation } from './api/exporterApi';
import { useDebugMode } from '../map/editor/useDebugMode';
import { InlineErrorComponent } from '../error/InlineErrorComponent';

export function ExportDialog({ mapId }: { mapId: string }) {
  const dialog = useDialogContainer();
  const [debugMode] = useDebugMode();

  const formatOptions = [{ key: 'gpx', name: 'GPX' }];
  if (debugMode)
    formatOptions.push({
      key: 'ptinternal',
      name: 'Internal (developer mode)',
    });
  const [format, setFormat] = useState<string>('gpx');

  const mutation = useExportMapMutation(mapId);

  return (
    <Dialog isDismissable>
      <Heading>Export map</Heading>
      <Divider />
      <Content>
        {mutation.isError && <InlineErrorComponent error={mutation.error} />}

        {(mutation.isIdle || mutation.isError) && (
          <Form
            onSubmit={(evt) => {
              evt.preventDefault();
              mutation.mutate({ format });
            }}
          >
            <div>
              <Picker
                label="Format"
                selectedKey={format}
                items={formatOptions}
                onSelectionChange={(key) => setFormat(key as string)}
              >
                {(item) => <Item key={item.key}>{item.name}</Item>}
              </Picker>
            </div>

            <div className="flex flex-row justify-end">
              <Button variant="accent" type="submit">
                Export
              </Button>
            </div>
          </Form>
        )}

        {mutation.isLoading && (
          <div>
            <ProgressBar label="Exporting..." isIndeterminate />
          </div>
        )}

        {mutation.isSuccess && (
          <div>
            <p>Your export is ready.</p>

            <div className="mt-4">
              <Button variant="accent" elementType="a" href={mutation.data.url}>
                Download
              </Button>
            </div>

            <div className="flex flex-row justify-end">
              <Button variant="primary" onPress={dialog.dismiss}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Content>
    </Dialog>
  );
}
