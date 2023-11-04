import { SVGProps } from 'react';

export function PointToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    // Cursor Pointer by Florent B from Noun Project
    <svg
      width="24"
      height="24"
      viewBox="0 0 25 25"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        cx="13"
        cy="13"
        r="5"
        fill="currentColor"
        stroke="black"
        strokeWidth="2"
      />
    </svg>
  );
}
