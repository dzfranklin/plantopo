import { SVGProps } from 'react';

export function LineToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 31 26"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M4 21L9.5 10.5L27 8" stroke="black" strokeWidth="2" />
      <circle
        cx="4.5"
        cy="20.5"
        r="3.5"
        fill="currentColor"
        stroke="black"
        strokeWidth="2"
      />
      <circle
        cx="26.5"
        cy="7.5"
        r="3.5"
        fill="currentColor"
        stroke="black"
        strokeWidth="2"
      />
    </svg>
  );
}
