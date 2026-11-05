// AC7 (S-022): Dev-only font render test — returns 404 in production.
// Check this page in a browser at /font-test to verify Latin, Sinhala and Tamil
// names render without empty boxes (see story Evidence for screenshot notes).
import { notFound } from "next/navigation";

export default function FontTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Font render test (dev only)</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Latin (Inter)</h2>
        <p className="text-base">John Smith — Health &amp; Safety Officer</p>
        <p className="text-base">Anna Fernandez — Training Coordinator</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sinhala (Noto Sans Sinhala)</h2>
        {/* Sample Sinhala names — REQ-190 readiness */}
        <p className="text-base">රාජපක්ෂ කමල් — ආරක්ෂක නිලධාරී</p>
        <p className="text-base">ෆොන්සේකා අනිල් — පුහුණු සම්බන්ධකාරක</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Tamil (Noto Sans Tamil)</h2>
        {/* Sample Tamil names — REQ-190 readiness */}
        <p className="text-base">குமாரசாமி ரவி — பாதுகாப்பு அதிகாரி</p>
        <p className="text-base">சுப்பிரமணியம் அனில் — பயிற்சி ஒருங்கிணைப்பாளர்</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Bold (EC2 — synthetic bold)</h2>
        <p className="text-base font-bold">රාජපක්ෂ කමල් — bold Sinhala</p>
        <p className="text-base font-bold">குமாரசாமி ரவி — bold Tamil</p>
      </section>
    </main>
  );
}
