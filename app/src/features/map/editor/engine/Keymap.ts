import { EngineCommand } from './EditorEngine';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  platform?: 'mac' | 'pc';
}

export type KeymapEntry<Command extends string = EngineCommand> = {
  binding: KeyBinding;
  cmd: Command;
};

export type KeymapSpec<Command extends string = EngineCommand> = Array<
  KeymapEntry<Command>
>;

export const DEFAULT_KEYMAP: KeymapSpec<EngineCommand> = [
  {
    cmd: 'undo',
    binding: { key: 'z', meta: true, platform: 'mac', shift: false },
  },
  {
    cmd: 'undo',
    binding: { key: 'z', ctrl: true, platform: 'pc', shift: false },
  },
  {
    cmd: 'redo',
    binding: { key: 'z', meta: true, platform: 'mac', shift: true },
  },
  {
    cmd: 'redo',
    binding: { key: 'z', ctrl: true, platform: 'pc', shift: true },
  },
  {
    cmd: 'select-line-tool',
    binding: { key: 'l', ctrl: false, alt: false, meta: false },
  },
  {
    cmd: 'select-point-tool',
    binding: { key: 'p', ctrl: false, alt: false, meta: false },
  },
  {
    cmd: 'delete-selected-feature',
    binding: {
      key: 'Backspace',
      ctrl: false,
      alt: false,
      meta: false,
    },
  },
  {
    cmd: 'delete-selected-feature',
    binding: { key: 'Delete', ctrl: false, alt: false, meta: false },
  },
  {
    cmd: 'finish-action',
    binding: { key: 'Enter', ctrl: false, alt: false, meta: false },
  },
];

/** KeyMap is a read-only mapping between commands and key bindings. */
export class Keymap<Command extends string = EngineCommand> {
  private _platform: 'mac' | 'pc';
  private _byCmd: Map<string, Array<KeymapEntry<Command>>> = new Map();
  private _byKey: Map<string, Array<KeymapEntry<Command>>> = new Map();

  constructor(platform: 'mac' | 'pc', spec: KeymapSpec<Command>) {
    this._platform = platform;
    for (const entry of spec) {
      const { cmd, binding } = entry;
      if (!this._byCmd.has(cmd)) {
        this._byCmd.set(cmd, []);
      }
      this._byCmd.get(cmd)!.push(entry);

      if (!this._byKey.has(binding.key)) {
        this._byKey.set(binding.key, []);
      }
      this._byKey.get(binding.key)!.push(entry);
    }
  }

  lookup(k: Omit<KeyBinding, 'platform'>): KeymapEntry<Command> | undefined {
    const candidates = this._byKey.get(k.key);
    if (!candidates) return undefined;
    for (const c of candidates) {
      const cb = c.binding;
      if (
        (cb.ctrl !== undefined && cb.ctrl !== k.ctrl) ||
        (cb.shift !== undefined && cb.shift !== k.shift) ||
        (cb.alt !== undefined && cb.alt !== k.alt) ||
        (cb.meta !== undefined && cb.meta !== k.meta) ||
        (cb.platform !== undefined && cb.platform !== this._platform)
      ) {
        continue;
      }
      return c;
    }
  }

  lookupByCmd(cmd: Command): readonly KeyBinding[] {
    return (this._byCmd.get(cmd) ?? [])
      .map((entry) => entry.binding)
      .filter((binding) => {
        if (binding.platform !== undefined) {
          return binding.platform === this._platform;
        }
        return true;
      });
  }
}

export function keyBindingToString(k: KeyBinding): string {
  const parts = [];
  if (k.ctrl) parts.push('ctrl');
  if (k.shift) parts.push('shift');
  if (k.alt) parts.push('alt');
  if (k.meta) parts.push('meta');
  parts.push(k.key);
  return parts.join('+');
}
