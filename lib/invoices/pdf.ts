import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { InvoiceDocument } from "./template";
import type { InvoiceDocumentProps } from "./template";

export async function buildInvoicePdf(
  order: InvoiceDocumentProps["order"],
  items: InvoiceDocumentProps["items"],
  invoice: InvoiceDocumentProps["invoice"],
): Promise<Buffer> {
  const el = createElement(InvoiceDocument, { order, items, invoice }) as unknown as ReactElement<DocumentProps>;
  const buf = await renderToBuffer(el);
  return Buffer.from(buf);
}
