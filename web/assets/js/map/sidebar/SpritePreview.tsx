import { useEffect, useRef } from 'react';
import data from '../../../../priv/static/sprite/preview.json';

export default function SpritePreview(
  props: { sprite: string } & React.SVGProps<SVGSVGElement>,
) {
  const raw = data[props.sprite];
  if (!raw) throw new Error(`Sprite ${props.sprite} not found`);
  const ref = useRef<SVGSVGElement>(null);
  const svgProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => key !== 'sprite'),
  );

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;

    const parser = new DOMParser();
    const source = parser
      .parseFromString(raw, 'image/svg+xml')
      .querySelector('svg')!;

    for (const attr of source.getAttributeNames()) {
      if (!svg.hasAttribute(attr)) {
        svg.setAttribute(attr, source.getAttribute(attr)!);
      }
    }

    if (!svg.hasAttribute('viewBox')) {
      svg.setAttribute('viewBox', '0 0 24 24');
    }

    for (const path of source.querySelectorAll('path')) {
      // So that we can override
      path.style.fill = '';
    }

    for (const child of source.childNodes) {
      svg.append(child);
    }
  }, [raw]);

  return <svg ref={ref} {...svgProps} />;
}
