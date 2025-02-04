import cls from '@/cls';

export function KVTable({
  entries,
  compact,
}: {
  entries: [React.ReactNode, React.ReactNode][];
  compact?: boolean;
}) {
  return (
    <table className="w-full">
      <tbody>
        {entries.map(([k, v], i) => (
          <tr
            key={i}
            className={cls(
              'border-gray-200',
              i !== 0 && 'border-t',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            <td
              className={cls(
                'text-xs font-medium text-gray-700 bg-gray-50',
                compact ? 'px-2 py-1' : 'px-3 py-2',
              )}
            >
              {k}
            </td>
            <td className={cls(compact ? 'px-2 py-1' : 'px-3 py-2')}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
