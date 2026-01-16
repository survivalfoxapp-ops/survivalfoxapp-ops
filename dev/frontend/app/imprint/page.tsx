"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const COLORS = {
  pageBg: "#1f1c18",
  text: "#EADFDA",
  textMuted: "#A39A92",
  border: "rgba(234,223,218,0.12)",
  panelBg: "rgba(255,255,255,0.02)",
};

export default function ImprintPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.pageBg, color: COLORS.text }}>
      <header
        className="sticky top-0 z-40"
        style={{ backgroundColor: COLORS.pageBg, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="h-10 w-10 rounded-md border flex items-center justify-center"
            style={{ borderColor: COLORS.border, backgroundColor: "transparent" }}
            aria-label="Zurück"
            title="Zurück"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-sm font-semibold">Impressum</div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            Platzhalter (MVP)
          </div>
          <p className="text-sm leading-relaxed">
            Hier kommt euer Impressum hinein. Für das MVP kann diese Seite zunächst als Platzhalter dienen, sollte aber
            vor Livegang rechtlich korrekt befüllt werden.
          </p>
        </div>
      </div>
    </main>
  );
}
