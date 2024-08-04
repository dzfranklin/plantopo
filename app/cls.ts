export default function cls(...c: unknown[]) {
  return c.filter(Boolean).join(' ');
}
