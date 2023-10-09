'use client';

import { useEffect, useState } from 'react';

export default function ThrowPage() {
  const [doThrow, setDoThrow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDoThrow(true);
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  if (doThrow) {
    throw new Error('test error');
  }

  return <p>This page throws a test error</p>;
}
