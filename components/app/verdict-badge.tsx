import { AlertTriangle, CircleCheck, CircleHelp, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Verdict } from '@/lib/types';
import { cn } from '@/lib/utils';

const CONFIG: Record<Verdict, { label: string; icon: typeof CircleCheck; variant: 'good' | 'review' | 'bad' }> = {
  good: { label: 'Good deal', icon: CircleCheck, variant: 'good' },
  review: { label: 'Review', icon: AlertTriangle, variant: 'review' },
  bad: { label: 'Bad deal', icon: ShieldAlert, variant: 'bad' },
};

export function VerdictBadge({
  verdict,
  className,
  showIcon = true,
}: {
  verdict: Verdict | null | undefined;
  className?: string;
  showIcon?: boolean;
}) {
  if (!verdict) {
    return (
      <Badge variant="outline" className={className}>
        {showIcon ? <CircleHelp className="h-3 w-3" /> : null}
        Not analysed
      </Badge>
    );
  }

  const { label, icon: Icon, variant } = CONFIG[verdict];
  return (
    <Badge variant={variant} className={cn('whitespace-nowrap', className)}>
      {showIcon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </Badge>
  );
}
