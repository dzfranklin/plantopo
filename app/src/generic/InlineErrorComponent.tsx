import { Button, Content, Heading, InlineAlert } from '@adobe/react-spectrum';
import ErrorTechInfo from './ErrorTechInfo';

export function InlineErrorComponent({ error }: { error: unknown }) {
  let message: string;
  if (typeof error === 'string') message = error;
  else if (error instanceof Error) message = error.message;
  else message = 'Internal error';

  return (
    <InlineAlert
      variant="negative"
      width="100%"
      marginTop="1rem"
      marginBottom="1rem"
    >
      <Heading>Error</Heading>
      <Content>
        <div className="flex flex-col gap-1">
          <p className="mb-2">Error: {message}</p>
          <p>
            If you need help you can contact me at my personal email
            daniel@danielzfranklin.org
          </p>
          <ErrorTechInfo error={error} />
          <div className="flex flex-row justify-end">
            <Button
              variant="primary"
              onPress={() => document.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      </Content>
    </InlineAlert>
  );
}
