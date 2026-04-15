/**
 * Adds a one-shot capture-phase click suppressor on window, used by drag
 * handlers to prevent a click from firing after a drag ends.
 */
export function suppressClick() {
  const handler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", handler, true);
  };
  window.addEventListener("click", handler, { capture: true });
  setTimeout(() => window.removeEventListener("click", handler, true), 0);
}
