import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface KeyboardShortcut {
  key: string;
  label: string;
  action: () => boolean;
}

const Context = createContext<Registry | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new Registry()).current;
  useEffect(() => {
    const handler = (evt: KeyboardEvent) => {
      for (const entry of registry.entries()) {
        if (evt.key === entry.key) {
          if (entry.action()) {
            evt.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [registry]);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}

export function useKeyboardShortcut(
  key: string,
  label: string,
  action: () => any,
): void {
  const context = useContext(Context);
  if (!context) throw new Error('ShortcutProvider not found');

  const savedAction = useRef(action);
  useEffect(() => {
    savedAction.current = action;
  }, [action]);

  useEffect(() => {
    const cleanup = context.register({
      key,
      label: label,
      action: () => savedAction.current(),
    });
    return cleanup;
  }, [context, key]);
}

/** Returned in order of insertion */
export function useCommands(): readonly KeyboardShortcut[] {
  const context = useContext(Context);
  if (!context) throw new Error('ShortcutProvider not found');
  const [entries, setEntries] = useState<readonly KeyboardShortcut[]>([]);
  useEffect(() => {
    setEntries(Array.from(context.entries()));
    context.onChange.add(setEntries);
    return () => {
      context.onChange.delete(setEntries);
    };
  }, [context]);
  return entries;
}

class Registry {
  private _entries: Array<KeyboardShortcut> = [];
  onChange: Set<(entries: readonly KeyboardShortcut[]) => any> = new Set();

  entries(): Readonly<KeyboardShortcut[]> {
    return this._entries.filter(Boolean);
  }

  register(entry: KeyboardShortcut): () => void {
    const i = this._entries.length;
    this._entries.push(entry);
    this._didChange();
    return () => {
      delete this._entries[i];
      this._didChange();
    };
  }

  private _didChange() {
    const entries = this.entries();
    this.onChange.forEach((cb) => cb(entries));
  }
}
