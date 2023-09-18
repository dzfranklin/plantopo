import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Form,
  TextField,
} from '@adobe/react-spectrum';
import { useState } from 'react';
import { MapMeta, usePutMapMetaMutation } from '../api/mapMeta';

export function RenamePopover({
  item,
  close,
}: {
  item: MapMeta;
  close: () => void;
}) {
  const [value, setValue] = useState(item.name);
  const mutation = usePutMapMetaMutation(item.id, { onSuccess: () => close() });
  const onSave = () => {
    if (value.length > 0) {
      mutation.mutate({ name: value });
    }
  };
  // TODO: This needs to display the error somewhere global because it will be closed
  return (
    <Dialog>
      <Content>
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
