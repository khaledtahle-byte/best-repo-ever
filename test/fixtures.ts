/** Builds a minimal, valid, uncompressed PDF with positioned text runs. */
export function buildPdf(runs: Array<{ x: number; y: number; text: string; size?: number }>): ArrayBuffer {
  let content = '';
  for (const { x, y, text, size = 10 } of runs) {
    const escaped = text.replace(/([()\\])/g, '\\$1');
    content += `BT /F1 ${size} Tf ${x} ${y} Td (${escaped}) Tj ET\n`;
  }

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  const bytes = Buffer.from(pdf, 'latin1');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** A realistic distributor quotation as a PDF. */
export function quotationPdf(): ArrayBuffer {
  return buildPdf([
    { x: 50, y: 750, text: 'Northside Food Supply Co', size: 14 },
    { x: 50, y: 730, text: 'Quotation Q-4417   Date: 12 August 2026', size: 10 },
    { x: 50, y: 700, text: 'Product' },
    { x: 250, y: 700, text: 'Qty' },
    { x: 320, y: 700, text: 'Unit Price' },
    { x: 420, y: 700, text: 'Disc' },
    { x: 490, y: 700, text: 'Total' },
    { x: 50, y: 680, text: 'Mozzarella 2.5kg block' },
    { x: 250, y: 680, text: '120' },
    { x: 320, y: 680, text: '18.40' },
    { x: 420, y: 680, text: '6%' },
    { x: 490, y: 680, text: '2075.52' },
    { x: 50, y: 660, text: 'Olive oil 5L tin' },
    { x: 250, y: 660, text: '40' },
    { x: 320, y: 660, text: '41.90' },
    { x: 420, y: 660, text: '0%' },
    { x: 490, y: 660, text: '1676.00' },
    { x: 50, y: 640, text: 'Tomato passata 12 x 690g' },
    { x: 250, y: 640, text: '60' },
    { x: 320, y: 640, text: '14.25' },
    { x: 420, y: 640, text: '5%' },
    { x: 490, y: 640, text: '812.25' },
    { x: 50, y: 600, text: 'Delivery charge: $145 per drop. Free delivery over $5,000.' },
    { x: 50, y: 585, text: 'Fuel surcharge 4% applies to all deliveries.' },
    { x: 50, y: 570, text: 'Payment terms: 2/10 net 30.' },
    { x: 50, y: 555, text: 'Volume rebate of 3% over 500 units, paid quarterly.' },
  ]);
}

export const QUOTE_CSV = `Northside Food Supply Co,,,,
Quotation Q-4417,,,,
,,,,
Item Code,Description,Qty,Unit Price,Discount %,Pack Size,Retail Price
MOZ-25,Mozzarella 2.5kg block,120,18.40,6,1,29.99
OIL-5L,Olive oil 5L tin,40,41.90,0,1,64.00
PAS-690,Tomato passata 12 x 690g,60,14.25,5,12,2.49
,,,,
Payment terms: 2/10 net 30,,,,
Delivery charge $145 per drop. Free delivery over $5000,,,,
Fuel surcharge 4%,,,,
`;

export const PASTED_QUOTE = `Northside Food Supply Co
Quotation Q-4417 - 12 August 2026

Product                     Qty    Unit Price   Disc    Total
Mozzarella 2.5kg block      120    18.40        6%      2075.52
Olive oil 5L tin            40     41.90        0%      1676.00
Tomato passata 12 x 690g    60     14.25        5%      812.25

Subtotal                                                4563.77
Delivery: $145 per drop. Free delivery over $5,000.
Fuel surcharge 4% applies to all deliveries.
Payment terms: 2/10 net 30
Volume rebate of 3% over 500 units, paid quarterly.
`;
