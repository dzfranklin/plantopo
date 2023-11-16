import stringOrd from '@/generic/stringOrd';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { usePeers } from '../engine/useEngine';
import { Session, useSession } from '@/features/account/session';
import { AwareEntry } from '../api/sessionMsg';

const maxShown = 10;

export function AwarenessComponent() {
  const sess = useSession();
  const peers = usePeers();
  return (
    <ul className="flex gap-1.5 max-w-[250px]">
      {peers
        .filter((p) => p.trusted.avatarURL)
        .sort((a, b) => stringOrd(a.trusted.clientId, b.trusted.clientId))
        .slice(0, maxShown)
        .map((p) => (
          <li key={p.trusted.clientId} className="flex flex-col justify-end">
            <TooltipTrigger>
              <Button
                className="rounded-full overflow-clip"
                aria-label={peerLabel(sess, p)}
              >
                <img
                  width="28px"
                  height="28px"
                  crossOrigin="anonymous"
                  src={p.trusted.avatarURL!}
                  alt=""
                />
              </Button>

              <Tooltip>{peerLabel(sess, p)}</Tooltip>
            </TooltipTrigger>
          </li>
        ))}

      {peers.length > maxShown && (
        <li className="-mb-0.5 -ml-0.5">
          <TooltipTrigger>
            <Button
              className="flex items-center justify-center px-1 rounded-full text-neutral-500"
              aria-label={peerOverflowLabel(sess, peers)}
            >
              +{peers.length - maxShown}
            </Button>

            <Tooltip>{peerOverflowLabel(sess, peers)}</Tooltip>
          </TooltipTrigger>
        </li>
      )}
    </ul>
  );
}

function peerLabel(sess: Session | null, p: AwareEntry): string {
  if (sess?.user.id === p.trusted.userId) {
    return `${p.trusted.name || 'Unnamed user'} (You)`;
  }
  return p.trusted.name || 'Unnamed user';
}

function peerOverflowLabel(
  sess: Session | null,
  peers: readonly AwareEntry[],
): string {
  return peers
    .slice(maxShown)
    .map((p) => peerLabel(sess, p))
    .join(', ');
}
