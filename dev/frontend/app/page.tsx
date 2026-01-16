"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ragAnswer, type RagApiError } from "../lib/api";
import { Slider } from "@/components/ui/slider";
import { Menu, Send, User } from "lucide-react";

/* =========================
   Types
========================= */

type RagSource = {
  title?: string;
  url?: string;
  source?: string;
  chunk_id?: string;

  author?: string;
  license_name?: string;
  license_url?: string;
};

type RagAnswerResult = {
  ok: boolean;
  session_id: string;
  thread_id: string;
  answer?: string;
  sources?: RagSource[];
  interaction_id?: string | null;
  meta?: Record<string, unknown>;
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;

  sources?: RagSource[]; // assistant-only
  interaction_id?: string; // assistant-only
};

/* =========================
   Local Storage Keys
========================= */

const LS_SESSION = "survivalfox_session_id";
const LS_THREAD = "survivalfox_thread_id";
const LS_MESSAGES = "survivalfox_messages_v1";
const LS_GAME_ID = "survivalfox_game_id";

/* =========================
   Game Themes
========================= */

type GameTheme = {
  id: string;
  label: string;
  accent: string;
};

const GAME_THEMES: Record<string, GameTheme> = {
  valheim: { id: "valheim", label: "VALHEIM", accent: "#4A5B4F" },
  starrupture: { id: "starrupture", label: "STAR RUPTURE", accent: "#3B4D9A" },
};

function getTheme(gameId: string): GameTheme {
  const key = (gameId ?? "").toLowerCase().trim();
  return (
    GAME_THEMES[key] ?? {
      id: key || "game",
      label: (gameId ?? "SPIEL").toUpperCase(),
      accent: "#6FA9C7",
    }
  );
}

/* =========================
   Spoiler snapping (0–100, 4 snap points)
========================= */

const SPOILER_SNAP_POINTS = [0, 33, 66, 100] as const;

function snapSpoilerLevel(v: number): number {
  const clamped = Math.max(0, Math.min(100, v));
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of SPOILER_SNAP_POINTS) {
    const d = Math.abs(clamped - p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function spoilerLabel(v: number): string {
  switch (v) {
    case 0:
      return "Keine Spoiler";
    case 33:
      return "Wichtige Hinweise";
    case 66:
      return "Tipps & Tricks";
    case 100:
      return "Volle Lösung";
    default:
      return "—";
  }
}

/* =========================
   Helpers
========================= */

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(LS_SESSION);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(LS_SESSION, id);
  return id;
}

function loadThreadId(): string | null {
  return localStorage.getItem(LS_THREAD);
}

function saveThreadId(threadId: string | null) {
  if (!threadId) localStorage.removeItem(LS_THREAD);
  else localStorage.setItem(LS_THREAD, threadId);
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_MESSAGES);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(LS_MESSAGES, JSON.stringify(messages));
  } catch {
    // ignore quota/privacy
  }
}

function loadGameId(): string {
  const existing = localStorage.getItem(LS_GAME_ID);
  if (existing) return existing;

  const def = "valheim";
  localStorage.setItem(LS_GAME_ID, def);
  return def;
}

function sourceKey(s: RagSource): string {
  return (
    s.url?.trim() ||
    s.title?.trim() ||
    s.source?.trim() ||
    s.chunk_id?.trim() ||
    JSON.stringify(s)
  );
}

function sourceLabel(s: RagSource): string {
  return s.title?.trim() || s.source?.trim() || s.url?.trim() || "Unbekannte Quelle";
}

function dedupeSources(sources: RagSource[]): RagSource[] {
  const map = new Map<string, RagSource>();
  for (const s of sources) {
    const key = sourceKey(s);
    if (!map.has(key)) map.set(key, s);
  }
  return Array.from(map.values());
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* =========================
   UI constants
========================= */

const COLORS = {
  pageBg: "#1f1c18",
  headerBg: "#46413C", // lighter gray, like your Figma vibe
  panelBg: "#2b2a27",
  panelBg2: "#3F3A35",

  // Bubbles (different fills)
  bubbleUserBg: "#6FA9C7", // user = light blue
  bubbleUserText: "#1f1c18",
  bubbleAssistantBg: "#4b4540", // assistant = warm gray
  bubbleAssistantText: "#EADFDA",

  text: "#EADFDA",
  textMuted: "#A39A92",
  border: "rgba(234,223,218,0.14)",
  accent: "#6FA9C7",
  warn: "#8C3A2B",
};

function FoxAvatar({
  accent,
  size = 40,
  overlap = 0,
}: {
  accent: string;
  size?: number;
  overlap?: number; // px; positive => overlaps downward
}) {
  return (
    <div
      className="rounded-xl flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: COLORS.panelBg,
        border: `2px solid ${accent}`,
        position: "relative",
        transform: overlap ? `translateY(${overlap}px)` : undefined,
        zIndex: overlap ? 60 : 1,
      }}
      aria-label="SurvivalFox"
      title="SurvivalFox"
    >
      <Image
        src="/survivalfox.png"
        alt="SurvivalFox"
        width={size}
        height={size}
        className="object-cover"
        priority={false}
      />
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        backgroundColor: COLORS.panelBg,
        border: `1px solid ${COLORS.border}`,
      }}
      aria-label="User"
      title="User"
    >
      <User size={18} color={COLORS.textMuted} />
    </div>
  );
}

/* =========================
   Page
========================= */

export default function Home() {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string>("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string>("valheim");

  const theme = useMemo(() => getTheme(gameId), [gameId]);

  const [spoilerLevel, setSpoilerLevel] = useState<number>(33);

  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<RagApiError | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourcesForMessageId, setSourcesForMessageId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);

    const tid = loadThreadId();
    setThreadId(tid);

    const stored = loadMessages();
    setMessages(stored);

    const gid = loadGameId();
    setGameId(gid);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const activeSources = useMemo(() => {
    if (!sourcesForMessageId) return [];
    const msg = messages.find((m) => m.id === sourcesForMessageId);
    return dedupeSources(msg?.sources ?? []).slice(0, 8);
  }, [messages, sourcesForMessageId]);

  function resetThread(): void {
    setThreadId(null);
    saveThreadId(null);

    setMessages([]);
    saveMessages([]);

    setErr(null);
    setQuery("");
    setSourcesForMessageId(null);
  }

  async function onAsk(): Promise<void> {
    const q = query.trim();
    if (!q || !sessionId || loading) return;

    setLoading(true);
    setErr(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      createdAt: Date.now(),
    };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      saveMessages(next);
      return next;
    });

    setQuery("");

    try {
      const data = (await ragAnswer({
        sessionId,
        threadId: threadId ?? undefined,
        query: q,
        spoilerLevel,
      })) as RagAnswerResult;

      setSessionId(data.session_id);
      localStorage.setItem(LS_SESSION, data.session_id);

      setThreadId(data.thread_id);
      saveThreadId(data.thread_id);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "",
        createdAt: Date.now(),
        sources: dedupeSources(data.sources ?? []).slice(0, 8),
        interaction_id: data.interaction_id ?? undefined,
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        saveMessages(next);
        return next;
      });
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null) setErr(e as RagApiError);
      else setErr({ name: "RagApiError", message: "Unbekannter Fehler", body: e });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.pageBg, color: COLORS.text }}>
      {/* Sticky Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: COLORS.headerBg,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Header fox: 50x50 + overlap downwards (hero feel) */}
            <FoxAvatar accent={theme.accent} size={50} overlap={10} />

            <div className="leading-tight pt-0.5">
              <div className="text-sm md:text-base font-medium">Der SurvivalFox führt dich durch</div>
              <div className="text-lg md:text-xl font-bold tracking-wide" style={{ color: theme.accent }}>
                {theme.label}
              </div>

              <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                Session: {sessionId ? sessionId.slice(0, 8) + "…" : "…"} · Thread:{" "}
                {threadId ? threadId.slice(0, 8) + "…" : "—"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="h-10 w-10 rounded-md border flex items-center justify-center"
            style={{ borderColor: COLORS.border, backgroundColor: "rgba(0,0,0,0.08)" }}
            aria-label="Menü"
            title="Menü"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Accent bar (game-themed, restrained) */}
        <div style={{ height: 3, backgroundColor: theme.accent, opacity: 0.6 }} />
      </header>

      {/* Content wrapper */}
      <div className="mx-auto max-w-2xl px-4">
        {/* Spoiler control */}
        <section
          className="pt-4 pb-3"
          style={{ borderBottom: `1px solid ${COLORS.border}` }}
          aria-label="Spoiler-Einstellungen"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
              Deine Spoiler-Einstellungen
            </div>
            <div className="text-sm font-semibold" style={{ color: COLORS.textMuted }}>
              {spoilerLabel(spoilerLevel)}
            </div>
          </div>

          <div className="mt-3">
            {/* Slider stays neutral (SurvivalFox palette) */}
            <Slider
              value={[spoilerLevel]}
              min={0}
              max={100}
              step={1}
              onValueChange={(val) => setSpoilerLevel(snapSpoilerLevel(val[0] ?? 33))}
            />
          </div>
        </section>

        {/* Chat List */}
        <section
          className="mt-4 mb-28 rounded-2xl border"
          style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div
            ref={listRef}
            className="h-[calc(100vh-340px)] min-h-[360px] overflow-y-auto p-4 space-y-4"
            aria-label="Chatverlauf"
          >
            {messages.length === 0 ? (
              <div className="text-sm" style={{ color: COLORS.textMuted }}>
                Unten im Chat kannst du dem SurvivalFox Fragen stellen.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const bubbleMax = "max-w-[85%]";

                const msgSources = dedupeSources(m.sources ?? []).slice(0, 5);

                if (isUser) {
                  return (
                    <div key={m.id} className="flex justify-end gap-3">
                      <div className={`${bubbleMax} space-y-2`}>
                        <div
                          className="rounded-2xl px-4 py-3 border"
                          style={{
                            borderColor: "rgba(0,0,0,0.15)",
                            backgroundColor: COLORS.bubbleUserBg,
                            color: COLORS.bubbleUserText,
                          }}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                          <div className="mt-2 text-[11px]" style={{ color: "rgba(0,0,0,0.55)" }}>
                            Du · {formatTime(m.createdAt)}
                          </div>
                        </div>
                      </div>

                      <UserAvatar />
                    </div>
                  );
                }

                // assistant
                const firstLink =
                  msgSources.find((s) => (s.url ?? "").startsWith("http"))?.url ??
                  msgSources.find((s) => (s.url ?? "").length > 0)?.url;

                const sourceText = msgSources.map(sourceLabel).join(" · ");

                return (
                  <div key={m.id} className="flex justify-start gap-3">
                    <FoxAvatar accent={theme.accent} size={40} />

                    <div className={`${bubbleMax} space-y-2`}>
                      <div
                        className="rounded-2xl px-4 py-3 border"
                        style={{
                          borderColor: COLORS.border,
                          backgroundColor: COLORS.bubbleAssistantBg,
                          color: COLORS.bubbleAssistantText,
                        }}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                        <div className="mt-2 text-[11px]" style={{ color: COLORS.textMuted }}>
                          Fuchs · {formatTime(m.createdAt)}
                          {m.interaction_id ? ` · ${m.interaction_id}` : ""}
                        </div>
                      </div>

                      {/* Attribution footer (restored): Quelle + Lizenz + Details */}
                      <div className="px-1 space-y-1">
                        <div className="text-[11px]" style={{ color: COLORS.textMuted }}>
                          <span className="font-semibold">Quelle:</span>{" "}
                          {firstLink ? (
                            <a
                              className="underline"
                              style={{ color: COLORS.accent }}
                              href={firstLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {sourceText || firstLink}
                            </a>
                          ) : (
                            <span style={{ color: COLORS.textMuted }}>{sourceText || "—"}</span>
                          )}

                          {msgSources.length > 0 && (
                            <>
                              <span style={{ color: COLORS.textMuted }}> · </span>
                              <button
                                type="button"
                                onClick={() => setSourcesForMessageId(m.id)}
                                className="underline"
                                style={{ color: COLORS.accent }}
                              >
                                Details
                              </button>
                            </>
                          )}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.textMuted }}>
                          <span className="font-semibold">Lizenz:</span>{" "}
                          {msgSources[0]?.license_url ? (
                            <a
                              className="underline"
                              style={{ color: COLORS.accent }}
                              href={msgSources[0].license_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {msgSources[0].license_name ?? "CC BY-SA"}
                            </a>
                          ) : (
                            <span>{msgSources[0]?.license_name ?? "CC BY-SA"}</span>
                          )}
                          <span style={{ color: COLORS.textMuted }}> · </span>
                          <span>ggf. zusammengefasst &amp; übersetzt</span>
                        </div>

                        
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Errors */}
        {err && (
          <div
            className="mb-4 rounded-lg border p-4"
            style={{ borderColor: COLORS.warn, backgroundColor: "rgba(140,58,43,0.12)" }}
          >
            <div className="font-semibold">Fehler</div>
            <pre className="text-xs overflow-auto mt-2" style={{ color: COLORS.textMuted }}>
              {JSON.stringify(err, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Sticky Composer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: COLORS.headerBg,
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3 space-y-2">
          <div
            className="flex items-end gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}
          >
            <textarea
              className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
              style={{ color: COLORS.text }}
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onAsk();
                }
              }}
              placeholder="Frag hier den SurvivalFox…"
              aria-label="Nachricht"
            />

            <button
              type="button"
              onClick={() => void onAsk()}
              disabled={loading || !query.trim() || !sessionId}
              className="h-10 w-10 rounded-full border flex items-center justify-center disabled:opacity-50"
              style={{ borderColor: COLORS.border, backgroundColor: "transparent" }}
              aria-label="Senden"
              title="Senden"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={resetThread}
              className="px-3 py-2 rounded-md border text-sm font-semibold"
              style={{
                borderColor: COLORS.border,
                color: COLORS.text,
                backgroundColor: "rgba(111,169,199,0.14)",
              }}
              title="Startet einen neuen Thread"
            >
              Neues Thema
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Sources details */}
      {sourcesForMessageId && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quellen-Details"
        >
          <button
            type="button"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            aria-label="Schließen"
            onClick={() => setSourcesForMessageId(null)}
          />

          <div
            className="relative w-full max-w-lg rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: COLORS.panelBg, borderColor: COLORS.border, color: COLORS.text }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Quellen & Lizenz</div>
                <div className="text-xs" style={{ color: COLORS.textMuted }}>
                  Vollständige Angaben zu Quelle, Autor und Lizenz.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSourcesForMessageId(null)}
                className="px-2 py-1 rounded-md border text-sm"
                style={{
                  borderColor: COLORS.border,
                  color: COLORS.text,
                  backgroundColor: "transparent",
                }}
              >
                Schließen
              </button>
            </div>

            {activeSources.length === 0 ? (
              <div className="text-sm" style={{ color: COLORS.textMuted }}>
                Keine Quellen vorhanden.
              </div>
            ) : (
              <div className="space-y-3">
                {activeSources.map((s, idx) => (
                  <div
                    key={sourceKey(s) + idx}
                    className="rounded-xl border p-3 space-y-1"
                    style={{ borderColor: COLORS.border, backgroundColor: COLORS.panelBg2 }}
                  >
                    <div className="text-sm font-semibold">{sourceLabel(s)}</div>

                    {s.url ? (
                      <div className="text-xs">
                        <a
                          className="underline"
                          style={{ color: COLORS.accent }}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.url}
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>
                        Kein Link verfügbar.
                      </div>
                    )}

                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      <span className="font-semibold">Autor:</span> {s.author ?? "—"}
                    </div>

                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      <span className="font-semibold">Lizenz:</span>{" "}
                      {s.license_url ? (
                        <a
                          className="underline"
                          style={{ color: COLORS.accent }}
                          href={s.license_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.license_name ?? "CC BY-SA"}
                        </a>
                      ) : (
                        <span>{s.license_name ?? "CC BY-SA"}</span>
                      )}
                    </div>

                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      <span className="font-semibold">Bearbeitung:</span> ggf. zusammengefasst &amp; übersetzt
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px]" style={{ color: COLORS.textMuted }}>
              Hinweis: Wenn Autor/Lizenz-Link noch „—“ sind, liefern wir diese Felder aktuell noch nicht aus dem Vektorstore
              mit.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
