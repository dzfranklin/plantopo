export default function* iterAll<T>(
  ...iters: Array<IterableIterator<T> | undefined>
): IterableIterator<T> {
  for (const iter of iters) {
    if (iter === undefined) continue;
    yield* iter;
  }
}
