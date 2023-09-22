const passwordPermittedSymbols = '~`! @#$%^&*()_-+={[}]|\\:;"\'<,>.?/';

export function validatePassword(value: string): string | undefined {
  for (const c of value) {
    if (
      ('A' <= c && c <= 'Z') ||
      ('a' <= c && c <= 'z') ||
      ('0' <= c && c <= '9') ||
      passwordPermittedSymbols.includes(c)
    ) {
      continue;
    } else {
      return (
        'may only contain English letters, numbers, and symbols ' +
        passwordPermittedSymbols
      );
    }
  }

  if (value.length < 8) {
    return 'must be at least 8 characters';
  } else if (value.length > 72) {
    return 'must not be more than 72 characters';
  }
}
