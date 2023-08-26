import { useEffect, useState } from 'react';
import { useCookies } from '@/generic/useCookies';
import { User } from '@/features/account/api/User';
import wrapError from '@/generic/wrapError';

export function useCurrentUser(): User | null {
  const cookies = useCookies();
  const [value, setValue] = useState<User | null>(null);
  useEffect(() => {
    const value = cookies['unchecked_user'];
    if (value) setValue(parseValue(value));
  }, [cookies]);
  return value;
}

function parseValue(value: string): User {
  try {
    const { id, name, email } = JSON.parse(atob(value));
    if (typeof id !== 'number') throw new Error('Invalid id');
    if (typeof name !== 'string') throw new Error('Invalid name');
    if (typeof email !== 'string') throw new Error('Invalid email');
    return { id, name, email };
  } catch (err) {
    throw wrapError(err, 'Failed to parse unchecked_user cookie');
  }
}
