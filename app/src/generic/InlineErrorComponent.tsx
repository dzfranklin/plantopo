import { Content, Heading, InlineAlert } from '@adobe/react-spectrum';
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
      marginTop="3rem"
      marginBottom="1rem"
    >
      <Heading>Error</Heading>
      <Content>
        <p className="mb-2">{message}</p>
        <ErrorTechInfo error={error} />
      </Content>
    </InlineAlert>
  );
}
