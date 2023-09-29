'use client';

import { useEffect } from 'react';

export default function ThrowPage() {
  useEffect(() => {
    throw new Error('This is a test error');
  }, []);

  return <p>This page throws a test error</p>;
}
