import { useSyncExternalStore } from "react";

interface DebugFlags {
  showDebugOptions: boolean;
  openDebugDialog: boolean;
  disableStrictMode: boolean;
  traceMapManager: boolean;
  openQueryDevtools: boolean;
  enableLogViewer: boolean;
  openLogViewer: boolean;
  mockNative: boolean;
  apiOffline: boolean;
}

const DEFAULT_VALUES: DebugFlags = {
  showDebugOptions: import.meta.env.DEV,
  openDebugDialog: false,
  disableStrictMode: false,
  traceMapManager: false,
  openQueryDevtools: false,
  enableLogViewer: false,
  openLogViewer: false,
  mockNative: false,
  apiOffline: false,
};

const RESTART_REQUIRED_FLAGS: (keyof DebugFlags)[] = [
  "disableStrictMode",
  "mockNative",
];

const DEBUG_FLAGS_EVENT = "debugFlagsChange";
const DEBUG_FLAGS_KEY = "debugFlags";

function readStorage(): DebugFlags {
  try {
    return parseFlags(localStorage.getItem(DEBUG_FLAGS_KEY));
  } catch {
    return DEFAULT_VALUES;
  }
}

let snapshot: DebugFlags = readStorage();

export function setDebugFlag(key: keyof DebugFlags, value: boolean) {
  snapshot = { ...snapshot, [key]: value };
  try {
    localStorage.setItem(DEBUG_FLAGS_KEY, serializeFlags(snapshot));
  } catch {
    // Ignore write errors
  }
  window.dispatchEvent(new Event(DEBUG_FLAGS_EVENT));

  if (RESTART_REQUIRED_FLAGS.includes(key)) {
    queueMicrotask(() => {
      if (confirm("This change requires a reload. Reload now?")) {
        window.location.reload();
      }
    });
  }
}

export function getDebugFlags() {
  return snapshot;
}

export function getDebugFlag(key: keyof DebugFlags) {
  return snapshot[key];
}

export function resetDebugFlags() {
  snapshot = DEFAULT_VALUES;
  try {
    localStorage.removeItem(DEBUG_FLAGS_KEY);
  } catch {
    // Ignore write errors
  }
  window.dispatchEvent(new Event(DEBUG_FLAGS_EVENT));
}

export function subscribeDebugFlags(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DEBUG_FLAGS_KEY) {
      snapshot = parseFlags(event.newValue);
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(DEBUG_FLAGS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DEBUG_FLAGS_EVENT, onChange);
  };
}

export function useDebugFlags() {
  return useSyncExternalStore(
    onChange => subscribeDebugFlags(onChange),
    () => snapshot,
    () => DEFAULT_VALUES,
  );
}

export function useDebugFlag(key: keyof DebugFlags) {
  const flags = useDebugFlags();
  return flags[key];
}

function parseFlags(value: string | null): DebugFlags {
  if (!value) return DEFAULT_VALUES;
  try {
    const parsed = JSON.parse(value);
    return { ...DEFAULT_VALUES, ...parsed };
  } catch {
    return DEFAULT_VALUES;
  }
}

function serializeFlags(flags: DebugFlags) {
  const obj: Partial<DebugFlags> = {};
  for (const key of Object.keys(DEFAULT_VALUES) as (keyof DebugFlags)[]) {
    if (flags[key] !== DEFAULT_VALUES[key]) {
      obj[key] = flags[key];
    }
  }
  return JSON.stringify(obj);
}
