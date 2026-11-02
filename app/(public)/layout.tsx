// AC2: public layout — Header, main, Footer, ScriptGate.
// No server-session reads allowed here — enforced by scripts/check-public-pages.ts.
import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ScriptGate } from "@/components/layout/ScriptGate";

export default function PublicLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      <Header />
      {/* AC1/AC9: id="main-content" is the skip-link target */}
      <main id="main-content">{children}</main>
      {modal}
      <Footer />
      {/* AC2: stub until S-028 (consent) and S-113 (ads) provide work */}
      <ScriptGate />
    </>
  );
}
