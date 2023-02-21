export default function classNames(...names: unknown[]) {
  return names.filter((n) => typeof n === 'string').join(' ');
}
