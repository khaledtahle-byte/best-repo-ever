'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, KeyRound, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

interface ApiKeySummary {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function ApiKeysPanel({ canUseApi }: { canUseApi: boolean }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(canUseApi);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canUseApi) return;
    let cancelled = false;

    fetch('/api/keys')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setKeys(data.keys ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canUseApi]);

  async function createKey() {
    setCreating(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Key ${keys.length + 1}` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The key could not be created.');
      setSecret(data.secret);
      setKeys((current) => [data.key, ...current]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The key could not be created.');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      const response = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('The key could not be revoked.');
      setKeys((current) =>
        current.map((key) => (key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key)),
      );
      toast.success('Key revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The key could not be revoked.');
    }
  }

  if (!canUseApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            API access
          </CardTitle>
          <CardDescription>
            Business includes an API for pushing offers in automatically from your inbox or ERP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="#billing">See the Business plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              API keys
            </CardTitle>
            <CardDescription>
              POST an offer to <code className="text-foreground">/api/v1/analyze</code> with a bearer token.
            </CardDescription>
          </div>
          <Button size="sm" onClick={createKey} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New key
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {secret ? (
          <Alert variant="info">
            <AlertTitle>Copy this key now</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>It is stored only as a hash, so it cannot be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
                  {secret}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No keys yet. Create one to start posting offers.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {key.name}
                    {key.revoked_at ? <Badge variant="outline">Revoked</Badge> : null}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.key_prefix}…
                    <span className="ml-2 font-sans">
                      created {formatDate(key.created_at)}
                      {key.last_used_at ? ` · last used ${formatDate(key.last_used_at)}` : ' · never used'}
                    </span>
                  </p>
                </div>
                {!key.revoked_at ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-bad"
                    onClick={() => revoke(key.id)}
                    aria-label={`Revoke ${key.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <pre className="overflow-x-auto rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
{`curl -X POST https://your-app.vercel.app/api/v1/analyze \\
  -H "Authorization: Bearer dg_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Mozzarella 2.5kg block  120  18.40  6%"}'`}
        </pre>
      </CardContent>
    </Card>
  );
}
