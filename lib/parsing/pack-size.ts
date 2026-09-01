import { parseNumber } from '@/lib/parsing/numbers';

export interface PackHint {
  packSize: number;
  uom: string;
}

const MEASURES = ['kg', 'g', 'l', 'ml', 'oz', 'lb', 'gal', 'cl'];

/**
 * Supplier descriptions carry the pack size that the price column does not:
 * "24 x 330ml", "Case of 12", "2.5kg block". Getting this wrong is the single
 * most common way a buyer compares two offers that are not comparable.
 */
export function packHintFromDescription(description: string): PackHint {
  const text = description.toLowerCase().replace(/×/g, 'x');

  // "24 x 330ml" — 24 inner units.
  const multi = text.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|oz|lb|cl)\b/);
  if (multi) {
    const count = parseNumber(multi[1]);
    if (count && count > 1) return { packSize: count, uom: multi[3] === 'g' ? 'unit' : 'unit' };
  }

  // "12 x tin", "6x1kg" handled above; "case of 12", "box of 24".
  const caseOf = text.match(/(?:case|box|carton|pack|tray)\s*of\s*(\d+)/);
  if (caseOf) {
    const count = parseNumber(caseOf[1]);
    if (count && count > 1) return { packSize: count, uom: 'unit' };
  }

  // "12ct", "24 pk", "6 pack".
  const counted = text.match(/\b(\d+)\s*(?:ct|count|pk|pack|pce|pcs)\b/);
  if (counted) {
    const count = parseNumber(counted[1]);
    if (count && count > 1) return { packSize: count, uom: 'unit' };
  }

  // "2.5kg block" — one physical unit, but the measure is the useful UOM.
  const measured = text.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|oz|lb|gal|cl)\b/);
  if (measured) {
    const amount = parseNumber(measured[1]);
    const unit = measured[2];
    if (amount && amount > 0 && MEASURES.includes(unit)) {
      // Price per kg/litre is what buyers actually compare on.
      return { packSize: amount, uom: unit };
    }
  }

  return { packSize: 1, uom: 'unit' };
}
