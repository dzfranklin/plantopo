import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Form,
  TextField,
} from '@adobe/react-spectrum';
import { useState } from 'react';
import { InlineErrorComponent } from '../components/InlineErrorComponent';
import { useMapRenameMutation } from '@/api/map/useMapRenameMutation';
import { MapMeta } from '@/api/map/MapMeta';

export function RenamePopover({
  item,
  close,
}: {
  item: MapMeta;
  close: () => void;
}) {
  const [value, setValue] = useState(item.name);
  const mutation = useMapRenameMutation(item.id, { onSuccess: () => close() });
  const onSave = () => {
    if (value.length > 0) {
      mutation.mutate(value);
    }
  };
  return (
    <Dialog>
      <Content>
        {mutation.isError && <InlineErrorComponent error={mutation.error} />}

        <Form
          isDisabled={mutation.isLoading}
          onSubmit={(evt) => {
            evt.preventDefault();
            onSave();
          }}
        >
          <TextField
            autoFocus
            isRequired
            label="New name"
            value={value}
            onChange={(value) => {
              setValue(value);
              mutation.reset();
            }}
          />
        </Form>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button
          variant="accent"
          onPress={onSave}
          isDisabled={mutation.isLoading}
        >
          {mutation.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}
