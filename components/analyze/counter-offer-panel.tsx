'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Loader2, Lock, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { CounterAsk } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';

interface CounterOffer {
  subject: string;
  body: string;
  value: number;
}

export function CounterOfferPanel({
  offerId,
  asks,
  currency,
  canGenerate,
}: {
  offerId: string | null;
  asks: CounterAsk[];
  currency: string;
  canGenerate: boolean;
}) {
  const [tone, setTone] = useState<'collaborative' | 'firm'>('collaborative');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [counter, setCounter] = useState<CounterOffer | null>(null);

  async function generate() {
    if (!offerId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/counter-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, tone, supplierContact: contact || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not draft the email.');
      setCounter(data as CounterOffer);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not draft the email.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!counter) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${counter.subject}\n\n${counter.body}`);
      setCopied(true);
      toast.success('Email copied to your clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Your browser blocked the clipboard. Select the text and copy it manually.');
    }
  }

  if (!canGenerate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Counter-offer email
          </CardTitle>
          <CardDescription>
            Pro drafts the email for you, with each ask priced from this analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {asks.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                This offer already has {asks.length} specific {asks.length === 1 ? 'ask' : 'asks'} worth{' '}
                {formatCurrency(
                  asks.reduce((acc, ask) => acc + Math.max(0, ask.value), 0),
                  currency,
                )}
                :
              </p>
              <ul className="mt-3 space-y-2">
                {asks.slice(0, 2).map((ask) => (
                  <li key={ask.code} className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                    {ask.ask}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <Button asChild className="mt-5 w-full sm:w-auto">
            <Link href="/app/settings">Upgrade to Pro</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Counter-offer email
        </CardTitle>
        <CardDescription>
          {asks.length > 0
            ? `${asks.length} specific ${asks.length === 1 ? 'ask' : 'asks'}, worth ${formatCurrency(
                asks.reduce((acc, ask) => acc + Math.max(0, ask.value), 0),
                currency,
              )} on this order.`
            : 'Nothing needs pushing back on, but you can still confirm the terms in writing.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={(value) => setTone(value as 'collaborative' | 'firm')}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collaborative">Collaborative — keep the relationship</SelectItem>
                <SelectItem value="firm">Firm — we will move the volume</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact">Their contact name</Label>
            <Input
              id="contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <Button onClick={generate} disabled={loading || !offerId}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : counter ? <RefreshCw className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          {counter ? 'Regenerate' : 'Draft the email'}
        </Button>

        {counter ? (
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium">{counter.subject}</span>
              </p>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-relaxed text-foreground/90">
              {counter.body}
            </pre>
          </div>
        ) : asks.length > 0 ? (
          <ul className="space-y-2">
            {asks.map((ask) => (
              <li key={ask.code} className="rounded-md border border-border bg-secondary/30 p-3">
                <p className="text-sm">{ask.ask}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{ask.rationale}</span>
                  {ask.value > 0 ? (
                    <span className="tabular font-medium text-primary">
                      {formatCurrency(ask.value, currency)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
