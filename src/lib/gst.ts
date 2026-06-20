// Centralised GST configuration. India dine-in: 5% (CGST 2.5% + SGST 2.5%).

export const GST_RATE = 5;
export const CGST_RATE = 2.5;
export const SGST_RATE = 2.5;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Split a pre-tax subtotal into GST / CGST / SGST / grand total. */
export function gstFromSubtotal(subtotal: number) {
  const cgst = round2((subtotal * CGST_RATE) / 100);
  const sgst = round2((subtotal * SGST_RATE) / 100);
  const gst = round2(cgst + sgst);
  const total = round2(subtotal + gst);
  return { gst, cgst, sgst, total };
}

/** Recompute totals for a single order line. */
export function recomputeLine(unit_price: number, quantity: number) {
  const subtotal = round2(unit_price * quantity);
  const t = gstFromSubtotal(subtotal);
  return {
    line_subtotal: subtotal,
    line_gst: t.gst,
    line_cgst: t.cgst,
    line_sgst: t.sgst,
    line_total: t.total,
  };
}
