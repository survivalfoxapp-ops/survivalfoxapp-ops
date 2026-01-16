"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const LS_GAME_ID = "survivalfox_game_id";
const LS_THREAD = "survivalfox_thread_id";
const LS_MESSAGES = "survivalfox_messages_v1";

const COLORS = {
  pageBg: "#1f1c18",
  panelBg: "#2b2a27",
  text: "#EADFDA",
  textMuted: "#A39A92",
  border: "rgba(234,223,218,0.12)",
  // SurvivalFox "global" accent (keep stable across the app)
  accent: "#6FA9C7",
};

type GameOption = {
  id: string;
  label: string;
  accent: string;
};

const GAMES: GameOption[] = [
  { id: "valheim", label: "VALHEIM", accent: "#4A5B4F" },
  { id: "starrupture", label: "STAR RUPTURE", accent: "#3B4D9A" },
];

export default function MenuPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string>("valheim");

  const activeGame = useMemo(() => {
    return GAMES.find((g) => g.id === gameId) ?? GAMES[0];
  }, [gameId]);

  useEffect(() => {
    const existing = localStorage.getItem(LS_GAME_ID);
    if (existing) setGameId(existing);
  }, []);

  function resetThreadAndMessages(): void {
    localStorage.removeItem(LS_THREAD);
    localStorage.removeItem(LS_MESSAGES);
  }

  function onSelectGame(nextId: string): void {
    const current = (localStorage.getItem(LS_GAME_ID) ?? "").toLowerCase();
    if (current !== nextId.toLowerCase()) {
      resetThreadAndMessages();
    }

    localStorage.setItem(LS_GAME_ID, nextId);
    setGameId(nextId);

    router.push("/");
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.pageBg, color: COLORS.text }}>
      <header
        className="sticky top-0 z-40"
        style={{ backgroundColor: COLORS.pageBg, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-10 w-10 rounded-md border flex items-center justify-center"
            style={{ borderColor: COLORS.border, backgroundColor: "transparent" }}
            aria-label="Zurück"
            title="Zurück"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="text-sm font-semibold">Menü</div>
        </div>

        {/* Dezenter Game-Akzent nur als Balken */}
        <div style={{ height: 3, backgroundColor: activeGame.accent, opacity: 0.55 }} />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        <section
          className="rounded-2xl border p-4 space-y-3"
          style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="text-sm font-semibold">Spiel auswählen</div>
          <div className="text-xs" style={{ color: COLORS.textMuted }}>
            Beim Wechsel wird der aktuelle Chat zurückgesetzt, damit der Kontext sauber bleibt.
          </div>

          <div className="mt-2 grid gap-2">
            {GAMES.map((g) => {
              const active = g.id === gameId;

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGame(g.id)}
                  className="px-3 py-3 rounded-xl border text-left"
                  style={{
                    borderColor: active ? g.accent : COLORS.border,
                    backgroundColor: active ? "rgba(255,255,255,0.03)" : COLORS.panelBg,
                    color: COLORS.text,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{g.label}</div>

                    {/* kleines Farbfeld als Hinweis */}
                    <div
                      className="h-5 w-5 rounded-md border"
                      aria-label={`Farbe ${g.label}`}
                      title={g.label}
                      style={{
                        backgroundColor: g.accent,
                        borderColor: "rgba(255,255,255,0.18)",
                      }}
                    />
                  </div>

                  {active && (
                    <div className="mt-2 text-xs font-semibold" style={{ color: g.accent }}>
                      Aktiv
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-2xl border p-4 space-y-2"
          style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="text-sm font-semibold">Rechtliches</div>

          {/* Textlinks nebeneinander; auf sehr schmalen Screens untereinander */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <a className="text-sm underline" style={{ color: COLORS.accent }} href="/privacy">
              Datenschutz
            </a>
            <a className="text-sm underline" style={{ color: COLORS.accent }} href="/imprint">
              Impressum
            </a>
          </div>
        </section>

        <div className="text-xs" style={{ color: COLORS.textMuted }}>
          SurvivalFox · Menü (MVP)
        </div>
      </div>
    </main>
  );
}
