import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'review' | 'bad' | 'primary';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
        </div>
        <p
          className={cn(
            'tabular mt-2 text-2xl font-semibold tracking-tight',
            tone === 'good' && 'text-good',
            tone === 'review' && 'text-review',
            tone === 'bad' && 'text-bad',
            tone === 'primary' && 'text-primary',
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
