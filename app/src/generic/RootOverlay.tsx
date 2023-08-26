import { useMemo } from 'react';
import { Overlay, OverlayProps } from 'react-aria';

export default function RootOverlay(
  props: Exclude<OverlayProps, 'portalContainer'>,
) {
  const root = useMemo(() => {
    const root = document.getElementById('portal-container');
    if (!root) throw new Error('Missing #portal-container');
    return root;
  }, []);
  return <Overlay {...props} portalContainer={root} />;
}
