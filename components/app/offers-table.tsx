import Link from 'next/link';
import { ChevronRight, FileSpreadsheet, FileText, ClipboardType, PencilLine, Plug } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VerdictBadge } from '@/components/app/verdict-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import type { OfferListItem } from '@/lib/queries';
import type { SourceTypeDb } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

const SOURCE_ICON: Record<SourceTypeDb, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  text: ClipboardType,
  manual: PencilLine,
  api: Plug,
};

export function OffersTable({ offers }: { offers: OfferListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Supplier</TableHead>
          <TableHead className="hidden sm:table-cell">Quoted</TableHead>
          <TableHead className="text-right">True net</TableHead>
          <TableHead className="hidden text-right md:table-cell">On the table</TableHead>
          <TableHead>Verdict</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {offers.map((offer) => {
          const Icon = SOURCE_ICON[offer.source_type] ?? FileText;
          const savings = Number(offer.savings_identified ?? 0);

          return (
            <TableRow key={offer.id} className="group">
              <TableCell className="max-w-[16rem]">
                <Link href={`/app/offers/${offer.id}`} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:text-primary">
                      {offer.supplier_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {offer.reference ? `${offer.reference} · ` : ''}
                      {offer.file_name ?? offer.source_type.toUpperCase()}
                    </span>
                  </span>
                </Link>
              </TableCell>

              <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">
                {formatDate(offer.quoted_at)}
              </TableCell>

              <TableCell className="tabular whitespace-nowrap text-right font-medium">
                {formatCurrency(Number(offer.net_total ?? 0), offer.currency)}
              </TableCell>

              <TableCell
                className={cn(
                  'tabular hidden whitespace-nowrap text-right md:table-cell',
                  savings > 0 ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {savings > 0 ? formatCurrency(savings, offer.currency) : '—'}
              </TableCell>

              <TableCell>
                <VerdictBadge verdict={offer.verdict} />
              </TableCell>

              <TableCell>
                <Link
                  href={`/app/offers/${offer.id}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={`Open the analysis for ${offer.supplier_name}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
