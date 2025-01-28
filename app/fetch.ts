export function assertOK(resp: Response): true {
  if (!resp.ok) {
    throw new Error(`failed to fetch: ${resp.url} has status ${resp.status}`);
  }
  return true;
}
