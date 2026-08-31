'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bad/10 text-bad">
          <TriangleAlert className="h-5 w-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error.message || 'The page could not be loaded. Your data is safe.'}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
