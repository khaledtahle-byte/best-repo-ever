const TONES = {
  plain: 'bg-white',
  yellow: 'bg-brand-yellow',
  red: 'bg-brand-red text-white',
} as const;

export function StatCard({
  label,
  value,
  sub,
  tone = 'plain',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className={`card p-4 ${TONES[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs font-bold opacity-70">{sub}</p> : null}
    </div>
  );
}
