export async function sendLogout() {
  await fetch('/account/logout', { method: 'DELETE' });
}
