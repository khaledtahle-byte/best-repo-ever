import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Logo />
      <p className="tabular mt-10 text-6xl font-semibold tracking-tight text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the analysis may belong to another account.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/app">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to site</Link>
        </Button>
      </div>
    </div>
  );
}
