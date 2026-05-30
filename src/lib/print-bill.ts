// Opens a print-ready bill in a new window. Works for thermal (80mm)
// and A4 via @media print rules; the user's print dialog picks the size.

export type BillOrder = {
  order_number: string;
  order_date: string;
  table_number: number;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
};

export type BillItem = {
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  gst_percentage: number;
  line_subtotal: number;
  line_gst: number;
  line_total: number;
};

export type BillMeta = {
  cafeName: string;
  tagline?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  paymentStatus?: "paid" | "unpaid";
};

const DEFAULT_META: BillMeta = {
  cafeName: "BrownSugar Café",
  tagline: "by Master Chef Devaki",
  address: "Chennai, Tamil Nadu, India",
  phone: "+91 12345 67890",
  gstin: "—",
  paymentStatus: "unpaid",
};

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inr(n: number): string {
  return `₹${Number(n).toFixed(2)}`;
}

export function printBill(order: BillOrder, items: BillItem[], metaIn?: Partial<BillMeta>) {
  const meta = { ...DEFAULT_META, ...metaIn };
  const created = new Date(order.created_at);
  const billNo = `B-${order.order_date.replace(/-/g, "")}-${order.order_number}`;
  const statusTag = order.status === "served" ? "SERVED" : order.status.toUpperCase();
  const payTag = (meta.paymentStatus ?? "unpaid").toUpperCase();

  const rows = items.map((it) => `
    <tr>
      <td class="l">
        <div class="nm">${esc(it.name)}</div>
        ${it.sku ? `<div class="sku">${esc(it.sku)}</div>` : ""}
      </td>
      <td class="c">${esc(it.quantity)}</td>
      <td class="r">${inr(it.unit_price)}</td>
      <td class="r">${esc(it.gst_percentage)}%</td>
      <td class="r">${inr(it.line_total)}</td>
    </tr>
  `).join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Bill ${esc(billNo)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums; }
  .sheet { padding: 16px; max-width: 780px; margin: 0 auto; }
  header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 8px; }
  .brand { font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .tag { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
  .meta { font-size: 11px; margin-top: 6px; line-height: 1.4; }
  .row { display: flex; justify-content: space-between; font-size: 12px; }
  .info { margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th, td { padding: 4px 2px; border-bottom: 1px dotted #999; vertical-align: top; }
  th { border-bottom: 1px solid #000; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .r { text-align: right; }
  .c { text-align: center; }
  .l { text-align: left; }
  .nm { font-weight: 600; }
  .sku { font-size: 10px; color: #555; }
  .totals { margin-top: 8px; font-size: 12px; }
  .totals .row { padding: 2px 0; }
  .grand { border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px;
    font-size: 15px; font-weight: 700; }
  .tags { margin-top: 10px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .tag-pill { font-size: 10px; padding: 2px 8px; border: 1px solid #000; border-radius: 999px;
    text-transform: uppercase; letter-spacing: 1px; }
  .note { margin-top: 8px; font-size: 11px; font-style: italic; border-top: 1px dashed #999; padding-top: 6px; }
  footer { text-align: center; margin-top: 14px; font-size: 11px; border-top: 1.5px dashed #000; padding-top: 8px; }
  .actions { text-align: center; margin: 12px 0; }
  .actions button { font-family: inherit; font-size: 13px; padding: 8px 18px; border: 1px solid #000;
    background: #000; color: #fff; border-radius: 999px; cursor: pointer; margin: 0 4px; }
  .actions button.alt { background: #fff; color: #000; }

  @media print {
    .actions { display: none; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 10mm; }
  }
  /* Thermal-friendly fallback when window is narrow */
  @media (max-width: 360px) {
    .sheet { padding: 6px; }
    .brand { font-size: 16px; }
    table, .row, .totals, footer { font-size: 11px; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">${esc(meta.cafeName)}</div>
      ${meta.tagline ? `<div class="tag">${esc(meta.tagline)}</div>` : ""}
      <div class="meta">
        ${meta.address ? `${esc(meta.address)}<br/>` : ""}
        ${meta.phone ? `Tel: ${esc(meta.phone)} · ` : ""}${meta.gstin ? `GSTIN: ${esc(meta.gstin)}` : ""}
      </div>
    </header>

    <section class="info">
      <div class="row"><span>Bill No</span><span><b>${esc(billNo)}</b></span></div>
      <div class="row"><span>Order No</span><span>#${esc(order.order_number)}</span></div>
      <div class="row"><span>Date</span><span>${esc(created.toLocaleDateString())} ${esc(created.toLocaleTimeString())}</span></div>
      <div class="row"><span>Table</span><span>${esc(order.table_number)}</span></div>
    </section>

    <table>
      <thead>
        <tr>
          <th class="l">Item</th>
          <th class="c">Qty</th>
          <th class="r">Price</th>
          <th class="r">GST</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${inr(order.subtotal)}</span></div>
      <div class="row"><span>Total GST</span><span>${inr(order.gst_amount)}</span></div>
      <div class="row grand"><span>TOTAL</span><span>${inr(order.total)}</span></div>
    </div>

    <div class="tags">
      <span class="tag-pill">${esc(statusTag)}</span>
      <span class="tag-pill">${esc(payTag)}</span>
    </div>

    ${order.notes ? `<div class="note">Note: ${esc(order.notes)}</div>` : ""}

    <footer>
      Thank you for dining with us!<br/>
      <span style="font-size:10px;opacity:.8">This is a computer-generated bill.</span>
    </footer>

    <div class="actions">
      <button onclick="window.print()">Print</button>
      <button class="alt" onclick="window.close()">Close</button>
    </div>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body></html>`;

  const w = window.open("", "_blank", "width=520,height=720");
  if (!w) {
    // Fallback: inline data URL
    window.location.href = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
