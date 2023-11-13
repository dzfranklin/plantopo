import cls from '@/generic/cls';
import { Button, Checkbox, Item, Picker } from '@adobe/react-spectrum';
import { useCallback, useState } from 'react';
import { usePutMapAccessMutation } from '../api/mapMeta';
import { UserAccessRole } from '../api/MapAccess';
import { InlineErrorComponent } from '@/features/error/InlineErrorComponent';

const DEFAULT_ROLE = 'editor';
const DEFAULT_NOTIFY = true;

export function UserInviteControl({ map }: { map: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserAccessRole>(DEFAULT_ROLE);
  const [notify, _setNotify] = useState(DEFAULT_NOTIFY);
  const [notifyMessage, setNotifyMessage] = useState('');
  const setNotify = useCallback((value: boolean) => {
    if (!value) setNotifyMessage('');
    _setNotify(value);
  }, []);
  const isExpanded = email.length > 0;

  const mutation = usePutMapAccessMutation(map, {
    onSuccess: () => {
      setEmail('');
      setRole(DEFAULT_ROLE);
      setNotify(DEFAULT_NOTIFY);
      setNotifyMessage('');
    },
  });
  const doSend = () => {
    mutation.mutate({
      invite: [
        {
          email,
          role,
          notify,
          notifyMessage: notifyMessage.length > 0 ? notifyMessage : undefined,
        },
      ],
    });
  };

  return (
    <form
      onSubmit={(evt) => {
        evt.preventDefault();
        doSend();
      }}
      className={cls(
        isExpanded ? 'pb-12' : 'pb-2',
        'motion-safe:transition-[padding]',
      )}
    >
      {mutation.isError && <InlineErrorComponent error={mutation.error} />}

      <div className="flex justify-end row-start-1 grow">
        <input
          type="email"
          placeholder="smith@example.com"
          aria-label="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cls(
            'p-1 bg-transparent border-t-0 border-b outline-none grow border-x-0',
            'border-neutral-700 focus:border-blue-600 invalid:border-red-600',
          )}
        />

        <Picker
          selectedKey={role}
          onSelectionChange={(key) => {
            if (key !== 'viewer' && key !== 'editor') {
              throw new Error('Unreachable');
            }
            setRole(key);
          }}
          aria-label="role"
          marginStart="1rem"
          menuWidth="8em"
          width="min-content"
          isQuiet
        >
          <Item key="viewer">Viewer</Item>
          <Item key="editor">Editor</Item>
        </Picker>
      </div>

      {isExpanded && (
        <div className="row-start-2 py-4">
          <div>
            <Checkbox isSelected={notify} onChange={setNotify}>
              Notify
            </Checkbox>
          </div>

          <textarea
            value={notifyMessage}
            onChange={(evt) => setNotifyMessage(evt.target.value)}
            disabled={!notify}
            placeholder="Message"
            aria-label="message"
            rows={3}
            className={cls(
              'w-full p-2 bg-transparent disabled:bg-neutral-200 resize-none',
              'outline-none border-t-0 border-b disabled:border-b-0 border-x-0 border-neutral-700 focus:border-blue-600 focus:ring-0',
            )}
          />

          <div className="flex justify-end mt-4">
            <Button variant="accent" type="submit">
              {notify
                ? mutation.isLoading
                  ? 'Sending...'
                  : 'Send'
                : mutation.isLoading
                ? 'Sharing...'
                : 'Share'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
