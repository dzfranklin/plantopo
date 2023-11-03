import { HTMLProps } from 'react';
import { KeyBinding } from '../map/editor/engine/Keymap';
import { useIsMac as platformIsMac } from '../platformIsMac';

export function KeybindingDisplay({
  binding,
}: { binding: KeyBinding } & HTMLProps<HTMLSpanElement>) {
  const isMac = platformIsMac();
  return (
    <span className="flex gap-[0.5px] text-gray-500 text-md">
      {binding.meta && <span>{isMac ? '⌘' : '⊞'}</span>}
      {binding.alt && <span>⌥</span>}
      {binding.ctrl && <span>⌃</span>}
      {binding.shift && <span>⇧</span>}
      <span>{binding.key}</span>
    </span>
  );
}
