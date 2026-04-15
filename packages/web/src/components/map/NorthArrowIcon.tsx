// Custom north arrow icon — north point up, south point down.
// North half is filled with current color, south half is dimmed.
export function NorthArrowIcon({
  size = 16,
  style,
  className,
}: {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}>
      {/* North half — points up */}
      <path d="M12 3 L15 12 L12 10 L9 12 Z" fill="currentColor" />
      {/* South half — points down, dimmed */}
      <path
        d="M12 21 L15 12 L12 14 L9 12 Z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  );
}
