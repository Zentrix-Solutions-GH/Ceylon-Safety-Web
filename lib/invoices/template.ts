import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { createElement } from "react";
import path from "path";
import type { SellerSnapshot } from "@/types/invoice";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(process.cwd(), "lib/invoices/fonts/NotoSans-Variable.ttf") },
    { src: path.join(process.cwd(), "lib/invoices/fonts/NotoSansSinhala.ttf") },
    { src: path.join(process.cwd(), "lib/invoices/fonts/NotoSansTamil.ttf") },
  ],
});

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSans", fontSize: 10, padding: 40, color: "#111" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  label: { color: "#555" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", padding: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", padding: 4 },
  col70: { width: "70%" },
  col15: { width: "15%", textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, fontSize: 11, fontWeight: "bold" },
  footer: { marginTop: 24, fontSize: 8, color: "#777" },
});

function formatLKR(cents: number): string {
  return (cents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface InvoiceDocumentProps {
  order: {
    id: string;
    payment_method: string;
    total_cents: number;
    billing_snapshot: {
      firstName: string;
      lastName: string;
      email: string;
      address: string;
      city: string;
      company?: string | null;
      taxId?: string | null;
    };
    coupon_snapshot: unknown | null;
  };
  items: Array<{
    document_id: string;
    title_en: string;
    language: string;
    unit_price_cents: number;
  }>;
  invoice: {
    invoice_number: string;
    issued_at: string;
    seller_snapshot: SellerSnapshot;
    tax_label: string | null;
    tax_rate_bps: number | null;
    tax_cents: number;
  };
}

export function InvoiceDocument({ order, items, invoice }: InvoiceDocumentProps) {
  const billing = order.billing_snapshot;
  const paymentLabel =
    order.payment_method === "bank_transfer" ? "Bank Transfer" : "Card Payment";

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },

      // Header
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.title }, "Invoice"),
        createElement(View, { style: styles.row },
          createElement(Text, null, `Invoice #${invoice.invoice_number}`),
          createElement(Text, null, formatDate(invoice.issued_at)),
        ),
        createElement(Text, { style: styles.label }, `Order: ${order.id}`),
      ),

      createElement(View, { style: styles.divider }),

      // Seller
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.label }, "From"),
        createElement(Text, null, invoice.seller_snapshot.name),
        createElement(Text, null, invoice.seller_snapshot.address),
      ),

      // Buyer
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.label }, "Bill To"),
        createElement(Text, null, `${billing.firstName} ${billing.lastName}`),
        billing.company ? createElement(Text, null, billing.company) : null,
        createElement(Text, null, billing.address),
        createElement(Text, null, billing.city),
        createElement(Text, null, billing.email),
      ),

      createElement(View, { style: styles.divider }),

      // Items table
      createElement(View, { style: styles.tableHeader },
        createElement(Text, { style: styles.col70 }, "Item"),
        createElement(Text, { style: styles.col15 }, "Lang"),
        createElement(Text, { style: styles.col15 }, "Amount (LKR)"),
      ),
      ...items.map((item) =>
        createElement(View, { key: item.document_id, style: styles.tableRow },
          createElement(Text, { style: styles.col70 }, item.title_en),
          createElement(Text, { style: styles.col15 }, item.language.toUpperCase()),
          createElement(Text, { style: styles.col15 }, formatLKR(item.unit_price_cents)),
        )
      ),

      createElement(View, { style: styles.total },
        createElement(Text, null, `Total: LKR ${formatLKR(order.total_cents)}`),
      ),

      createElement(View, { style: styles.divider }),

      // Payment
      createElement(View, { style: styles.section },
        createElement(View, { style: styles.row },
          createElement(Text, { style: styles.label }, "Payment method"),
          createElement(Text, null, paymentLabel),
        ),
      ),

      // Footer
      createElement(View, { style: styles.footer },
        createElement(Text, null,
          "Goods once sold are non-refundable unless defective. For enquiries contact support@ceylonsafety.lk."
        ),
      ),
    )
  );
}
