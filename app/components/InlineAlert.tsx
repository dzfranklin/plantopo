import cls from '@/cls';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';

const variants = {
  warning: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    Icon: (
      <ExclamationTriangleIcon
        className="h-5 w-5 text-yellow-400"
        aria-hidden="true"
      />
    ),
  },
  error: {
    border: 'border-red-400',
    bg: 'bg-red-50',
    text: 'text-red-700',
    Icon: <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />,
  },
  success: {
    border: 'border-green-400',
    bg: 'bg-green-50',
    text: 'text-green-700',
    Icon: (
      <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
    ),
  },
  info: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    Icon: (
      <InformationCircleIcon
        className="h-5 w-5 text-blue-400"
        aria-hidden="true"
      />
    ),
  },
};

export default function InlineAlert({
  variant = 'info',
  children,
}: {
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  const values = variants[variant];
  return (
    <div className={cls('my-2 border-l-4 p-4', values.border, values.bg)}>
      <div className="flex w-full overflow-auto">
        <div className="flex-shrink-0">{values.Icon}</div>
        <div className={cls('ml-3 text-sm', values.text)}>{children}</div>
      </div>
    </div>
  );
}

InlineAlert.Subtext = function InlineAlertSubtext({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mt-2 text-gray-600 text-sm">{children}</div>;
};
