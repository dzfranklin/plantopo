import { Keymap } from './Keymap';

test('picks earlier even if unspecified modifier is present', () => {
  const subject = new Keymap('pc', [
    {
      cmd: 'should-pick',
      binding: { key: 'a' },
    },
    {
      cmd: 'should-not-pick',
      binding: { key: 'a', ctrl: true },
    },
  ]);
  expect(subject.lookup({ key: 'a', ctrl: true })?.cmd).toBe('should-pick');
});

test('platform-specific lookup works', () => {
  const subject = new Keymap('mac', [
    {
      cmd: 'undo',
      binding: { key: 'z', meta: true, platform: 'mac', shift: false },
    },
  ]);
  expect(
    subject.lookup({
      key: 'z',
      ctrl: false,
      shift: false,
      alt: false,
      meta: true,
    })!.cmd,
  ).toBe('undo');
});
