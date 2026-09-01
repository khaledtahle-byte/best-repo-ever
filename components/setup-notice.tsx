import { Terminal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const REQUIRED = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'Supabase → Project Settings → API' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Supabase → Project Settings → API' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Same page. Server-side only.' },
];

/**
 * Shown instead of a stack trace when the app is running without credentials —
 * the first thing a new developer sees should tell them what to do.
 */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <Card>
      <CardHeader>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Terminal className="h-5 w-5" />
        </span>
        <CardTitle className="pt-3">Finish the setup first</CardTitle>
        <CardDescription>
          DealGuard needs a Supabase project before it can sign anyone in. It takes about five
          minutes — the exact steps are in README.md.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            1. Create a Supabase project, then run <code className="text-foreground">supabase/schema.sql</code>{' '}
            in the SQL editor.
          </li>
          <li>
            2. Copy <code className="text-foreground">.env.example</code> to{' '}
            <code className="text-foreground">.env.local</code> and fill in the keys below.
          </li>
          <li>
            3. Restart <code className="text-foreground">npm run dev</code>.
          </li>
        </ol>

        <ul className="divide-y divide-border/70 rounded-lg border border-border">
          {REQUIRED.map((variable) => {
            const isMissing = missing.includes(variable.name);
            return (
              <li key={variable.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <code className="font-mono text-xs">{variable.name}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{variable.hint}</p>
                </div>
                <span className={isMissing ? 'text-xs text-bad' : 'text-xs text-good'}>
                  {isMissing ? 'Not set' : 'Set'}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
