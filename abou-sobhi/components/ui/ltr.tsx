/**
 * Isolates left-to-right content inside Arabic text.
 *
 * Without this, the bidi algorithm reorders the runs of a phone number, an
 * order code or a coordinate pair around their separators, so `71 123 456`
 * renders as `456 123 71` and `34.43, 35.84` comes out backwards. `<bdi>` is
 * the element made for exactly this; `dir="ltr"` fixes the direction inside it.
 */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}
