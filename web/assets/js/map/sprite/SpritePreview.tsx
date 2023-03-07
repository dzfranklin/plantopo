import { useEffect, useRef } from 'react';
import data from './preview.json';

export default function SpritePreview(
  props: { sprite: string } & React.SVGProps<SVGSVGElement>,
) {
  const raw = data[props.sprite];

  const ref = useRef<SVGSVGElement>(null);
  const svgProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => key !== 'sprite'),
  );

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;

    if (!raw) {
      console.error(`Sprite ${props.sprite} not found`);
      return;
    }

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

    for (const elem of source.querySelectorAll('*')) {
      if (!(elem instanceof SVGElement)) continue;
      // So that we can override
      elem.style.fill = '';
      elem.style.stroke = '';
      elem.style.opacity = '1';
      elem.setAttribute('fill', '');
      elem.setAttribute('stroke', '');
    }

    svg.innerHTML = '';
    for (const child of source.childNodes) {
      svg.append(child);
    }
  }, [props.sprite, raw]);

  return <svg ref={ref} {...svgProps} />;
}
