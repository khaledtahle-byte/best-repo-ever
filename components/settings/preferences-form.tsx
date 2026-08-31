'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { ProfileRow } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export function PreferencesForm({ profile }: { profile: ProfileRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: profile.full_name ?? '',
    companyName: profile.company_name ?? '',
    costOfCapitalPct: String(profile.cost_of_capital_pct ?? 12),
    targetMarginPct: String(profile.target_margin_pct ?? 25),
    defaultCurrency: profile.default_currency ?? 'USD',
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName || null,
          companyName: form.companyName || null,
          costOfCapitalPct: Number(form.costOfCapitalPct) || 0,
          targetMarginPct: Number(form.targetMarginPct) || 0,
          defaultCurrency: form.defaultCurrency,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not save your settings.');
      toast.success('Settings saved');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis settings</CardTitle>
        <CardDescription>
          These two numbers change what DealGuard tells you: the first prices your payment terms,
          the second decides when a line is called thin.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Sam Okafor"
              />
              <p className="text-xs text-muted-foreground">Signed at the bottom of counter-offer emails.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Business name</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Corner Street Deli"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost of capital (% a year)</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.costOfCapitalPct}
                onChange={(e) => setForm({ ...form, costOfCapitalPct: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                What your cash is worth. Prices payment terms and rebate delays.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="margin">Target gross margin (%)</Label>
              <Input
                id="margin"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.targetMarginPct}
                onChange={(e) => setForm({ ...form, targetMarginPct: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Lines below this are flagged as thin.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Default currency</Label>
              <Select
                value={form.defaultCurrency}
                onValueChange={(value) => setForm({ ...form, defaultCurrency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
