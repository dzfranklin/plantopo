export function setHashParam(key: string, value: string | null) {
  const hash = location.hash.slice(1);
  const parts = hash ? hash.split("&") : [];
  const idx = parts.findIndex(p => p.startsWith(`${key}=`));
  if (value === null) {
    if (idx !== -1) parts.splice(idx, 1);
  } else {
    const entry = `${key}=${value}`;
    if (idx === -1) {
      parts.push(entry);
    } else {
      parts[idx] = entry;
    }
  }
  const newHash = parts.join("&");
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${newHash ? "#" + newHash : ""}`,
  );
}

export function getHashParam(key: string): string | null {
  const hash = location.hash.slice(1);
  for (const part of hash.split("&")) {
    if (part.startsWith(`${key}=`)) return part.slice(key.length + 1);
  }
  return null;
}
