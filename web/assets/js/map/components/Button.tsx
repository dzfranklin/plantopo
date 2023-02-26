import { motion } from 'framer-motion';
import classNames from '../../classNames';

export interface Props {
  style?: 'primary' | 'secondary';
  children?: JSX.Element | JSX.Element[] | string;
  onClick?: () => void;
  disableWith?: string | JSX.Element;
  className?: string;
}

const baseStyle =
  'inline-flex items-center h-min rounded border m-1 px-2 py-1 text-xs font-medium ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400';

const styles = {
  primary:
    'border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-700',
  secondary: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
};

export default function Button(props: Props) {
  const isDisabled = typeof props.disableWith === 'string';
  return (
    <motion.button
      type="button"
      className={classNames(
        baseStyle,
        styles[props.style || 'secondary'],
        props.className,
      )}
      onClick={() => props.onClick?.()}
      disabled={isDisabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      transition={
        {
          // type: 'spring',
          // duration: window.appSettings.disableAnimation ? 0 : 0.3,
        }
      }
    >
      {isDisabled ? props.disableWith : props.children}
    </motion.button>
  );
}
