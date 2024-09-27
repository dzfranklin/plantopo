import * as ml from 'maplibre-gl';
import { ReactNode, ReactPortal, useRef } from 'react';
import { createPortal } from 'react-dom';

class PortalControl implements ml.IControl {
  container = document.createElement('div');

  onAdd(_map: ml.Map): HTMLElement {
    return this.container;
  }

  onRemove(_map: ml.Map): void {
    this.container?.remove();
  }
}

export function usePortalControl(
  children: ReactNode,
  key?: string,
): [ReactPortal, ml.IControl] {
  const ref = useRef<PortalControl | null>(null);
  if (!ref.current) ref.current = new PortalControl();
  const portal = createPortal(children, ref.current.container, key);
  return [portal, ref.current];
}
