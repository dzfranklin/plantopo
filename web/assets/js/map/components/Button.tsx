export interface Props {
  style?: 'primary' | 'secondary';
  children?: JSX.Element | string;
  onClick?: () => void;
  disableWith?: string | JSX.Element;
  className?: string;
}

const styles = {
  primary:
    'inline-flex items-center h-min rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  secondary:
    'inline-flex items-center h-min rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
};

export default function Button(props: Props) {
  const isDisabled = typeof props.disableWith === 'string';
  return (
    <button
      type="button"
      className={
        styles[props.style || 'secondary'] + ' ' + props.className || ''
      }
      onClick={() => props.onClick?.()}
      disabled={isDisabled}
    >
      {isDisabled ? props.disableWith : props.children}
    </button>
  );
}
