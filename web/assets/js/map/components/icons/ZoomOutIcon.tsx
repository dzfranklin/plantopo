import * as React from "react";
const SvgZoomOutIcon = (props) => (
  <svg
    fill="none"
    strokeWidth={1.5}
    stroke="currentColor"
    className="zoom_out_icon_svg__w-6 zoom_out_icon_svg__h-6"
    width={14}
    height={14}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M13.025 7H.975"
      style={{
        strokeWidth: 1.95054,
        strokeLinecap: "round",
        strokeMiterlimit: 4,
        strokeDasharray: "none",
      }}
    />
    <path
      d="M7 0v14"
      style={{
        fill: "none",
        stroke: "none",
        strokeWidth: 1.95054,
        strokeLinecap: "round",
        strokeMiterlimit: 4,
        strokeDasharray: "none",
      }}
      stroke="none"
    />
  </svg>
);
export default SvgZoomOutIcon;
