'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS } from '@/lib/plans';
import type { PlanId } from '@/lib/types';

type Mode = 'login' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const next = params.get('next') ?? '/app';
  const planParam = params.get('plan');
  const plan: PlanId | null = planParam === 'pro' || planParam === 'business' ? planParam : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const fullName = String(form.get('full_name') ?? '').trim();
    const companyName = String(form.get('company_name') ?? '').trim();

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, company_name: companyName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              plan ? `/app/settings?upgrade=${plan}` : next,
            )}`,
          },
        });
        if (signUpError) throw signUpError;

        // With email confirmation switched on there is no session yet.
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      toast.success(mode === 'signup' ? 'Account created' : 'Signed in');
      startTransition(() => {
        router.push(plan ? `/app/settings?upgrade=${plan}` : next);
        router.refresh();
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Confirm your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We have sent a confirmation link. Open it and you will land straight in your dashboard.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const busy = loading || isPending;

  return (
    <Card>
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-2xl">
          {mode === 'signup' ? 'Create your account' : 'Sign in'}
        </CardTitle>
        <CardDescription>
          {mode === 'signup'
            ? plan
              ? `Start on ${PLANS[plan].name} — you can confirm billing on the next screen.`
              : 'Three offer analyses a month, free. No card required.'
            : 'Welcome back. Your supplier history is where you left it.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8">
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'signup' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Your name</Label>
                <Input id="full_name" name="full_name" autoComplete="name" placeholder="Sam Okafor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Business name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  autoComplete="organization"
                  placeholder="Corner Street Deli"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@business.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === 'signup' ? (
                <span className="text-xs text-muted-foreground">At least 8 characters</span>
              ) : null}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
