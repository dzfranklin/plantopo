'use client';

import { LoginScreen } from '@/features/login/LoginScreen';

export default function Page({
  searchParams: { returnTo },
}: {
  searchParams: { returnTo?: string };
}) {
  return <LoginScreen isSignup={true} returnTo={returnTo} />;
}
