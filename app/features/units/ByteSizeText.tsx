import { formatByteSize } from '@/features/units/format';

export function ByteSizeText({ bytes }: { bytes: number }) {
  return <span>{formatByteSize(bytes)}</span>;
}
