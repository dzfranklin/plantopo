import { SVGProps } from 'react';

export function SelectToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path
        fill="black"
        d="M20.26 13.555 7.744.807a.812.812 0 0 0-1.39.541l-.152 17.856a.812.812 0 0 0 1.304.682l3.474-2.587 2.549 6.315a.812.812 0 0 0 1.082.449l3.008-1.218a.812.812 0 0 0 .45-1.082l-2.582-6.287 4.297-.541a.812.812 0 0 0 .476-1.375zm-6.023.444a.812.812 0 0 0-.649 1.082l2.64 6.536-1.504.606-2.64-6.509a.812.812 0 0 0-1.24-.346l-3.002 2.24.119-14.263 9.994 10.178z"
      />
    </svg>
  );
}
