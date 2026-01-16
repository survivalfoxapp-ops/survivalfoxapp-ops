import { supabase } from "./supabase";

export type RagAnswerRequest = {
  // Required by backend contract for rate-limits / abuse prevention
  sessionId: string;

  // Optional: when present, backend will attach the interaction to this thread.
  // When absent, backend will mint a new thread_id and return it.
  threadId?: string;

  query: string;

  // Preferred spelling in backend contract: spoilerLevel (0–100)
  spoilerLevel: number;

  // Optional knobs (kept generic; only send when you actually use them)
  matchCount?: number;
  docFilter?: string | null;

  // Preferred spelling: developer_mode
  developerMode?: boolean;
};

export type RagApiError = {
  name: string;
  message: string;
  status?: number;
  statusText?: string;
  body?: unknown;
};

function normalizeSupabaseFunctionError(err: unknown): RagApiError {
  const base: RagApiError = {
    name: "RagApiError",
    message: "Request failed",
  };

  if (err instanceof Error) {
    base.name = err.name || base.name;
    base.message = err.message || base.message;
  }

  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;

    if (typeof e.name === "string") base.name = e.name;
    if (typeof e.message === "string") base.message = e.message;

    // supabase-js Functions errors often expose status/context
    if (typeof e.status === "number") base.status = e.status;

    const ctx = e.context;
    if (typeof ctx === "object" && ctx !== null) {
      const c = ctx as Record<string, unknown>;
      if (typeof c.status === "number") base.status = c.status;
      if (typeof c.statusText === "string") base.statusText = c.statusText;
      if ("body" in c) base.body = c.body;
    }

    if (base.body === undefined) base.body = e;
  }

  return base;
}

function isValidUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  // Simple UUID v4-ish check; backend will validate strictly anyway.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Calls POST /functions/v1/rag-answer-dev via supabase.functions.invoke
 * Contract:
 * - Sends: query (required), session_id (optional but we always send), thread_id (optional)
 * - Sends preferred keys: spoilerLevel, developer_mode (no legacy keys for new code)
 * - Expects: ok, session_id, thread_id, answer, sources, interaction_id, meta
 */
export async function ragAnswer(req: RagAnswerRequest) {
  const body: Record<string, unknown> = {
    query: req.query,
    // Backend accepts optional session_id; we always send it for stable client behavior
    session_id: req.sessionId,
    // Preferred key per current contract
    spoilerLevel: req.spoilerLevel,
  };

  // thread_id: only include if present and plausibly valid
  if (req.threadId && isValidUuid(req.threadId)) {
    body.thread_id = req.threadId;
  }

  // optional retrieval knobs
  if (typeof req.matchCount === "number") body.match_count = req.matchCount;
  if (req.docFilter !== undefined) body.doc_filter = req.docFilter;

  // developer mode (preferred spelling)
  if (typeof req.developerMode === "boolean") body.developer_mode = req.developerMode;

  const { data, error } = await supabase.functions.invoke("rag-answer-dev", { body });

  if (error) {
    throw normalizeSupabaseFunctionError(error);
  }

  // Defensive: ensure the backend actually returned the guaranteed IDs
  if (!data || typeof data !== "object") {
    throw {
      name: "RagApiError",
      message: "Invalid response payload",
      status: 500,
      body: data,
    } satisfies RagApiError;
  }

  const d = data as Record<string, unknown>;
  if (!isValidUuid(d.session_id) || !isValidUuid(d.thread_id)) {
    // If backend returned something unexpected, surface it for debugging
    throw {
      name: "RagApiError",
      message: "Backend response missing session_id/thread_id",
      status: 500,
      body: data,
    } satisfies RagApiError;
  }

  return data;
}
