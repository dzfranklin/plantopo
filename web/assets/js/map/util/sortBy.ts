export default function sortBy<T, B>(list: T[], key: (item: T) => B) {
  return list.slice().sort((a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
}
