import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-xl" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
