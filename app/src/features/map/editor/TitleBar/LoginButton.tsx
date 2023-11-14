export function LoginButton() {
  return (
    <a
      className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      href="/login"
      onClick={(evt) => {
        evt.preventDefault();
        location.href =
          '/login?returnTo=' +
          encodeURIComponent(location.pathname + location.search);
      }}
    >
      Login
    </a>
  );
}
