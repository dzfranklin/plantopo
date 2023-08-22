import { useMemo } from 'react';
import { Overlay, OverlayProps } from 'react-aria';

export default function RootOverlay(
  props: Exclude<OverlayProps, 'portalContainer'>,
) {
  const root = useMemo(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('Missing #root');
    return root;
  }, []);
  return <Overlay {...props} portalContainer={root} />;
}
