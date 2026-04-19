if (typeof globalThis.requestIdleCallback === "undefined") {
  globalThis.requestIdleCallback = cb =>
    setTimeout(
      () => cb({ didTimeout: false, timeRemaining: () => 0 }),
      0,
    ) as unknown as ReturnType<typeof requestIdleCallback>;
  globalThis.cancelIdleCallback = id =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
}
