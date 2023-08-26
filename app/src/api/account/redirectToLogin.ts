export function goToLogin() {
  document.location.replace(
    `/account/login?return=${encodeURIComponent(
      location.pathname + location.search,
    )}`,
  );
}
