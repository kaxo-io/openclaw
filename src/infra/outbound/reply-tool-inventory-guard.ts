type ToolEvidence = {
  toolName: string;
  observedAt: number;
};

export type ReplyToolInventoryGuardDecision =
  | { ok: true }
  | {
      ok: false;
      reason: string;
    };

const TOOL_EVIDENCE_TTL_MS = 15 * 60 * 1000;
const MAX_EVIDENCE_ENTRIES = 500;
const evidenceByRunId = new Map<string, ToolEvidence>();
const evidenceBySessionKey = new Map<string, ToolEvidence>();

const NON_QUERY_TOOL_PATTERNS = [
  /^message(?:$|[._-])/i,
  /^reaction(?:$|[._-])/i,
  /(?:^|[._-])update_plan$/i,
  /(?:^|[._-])sessions_yield$/i,
  /(?:^|[._-])request_user_input$/i,
  /(?:^|[._-])wait_agent$/i,
  /(?:^|[._-])close_agent$/i,
  /(?:^|[._-])send_input$/i,
];

const HUMAN_DATA_REQUEST_PATTERNS = [
  /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:paste|send|share|provide|copy)\b/i,
  /\b(?:paste|send|share|provide|copy)\s+(?:me\s+)?(?:the|your|that|those)\b/i,
  /\bdo\s+you\s+have\s+(?:access|the\s+(?:link|file|doc|document|screenshot|data|export))\b/i,
  /\bcan\s+you\s+(?:check|look\s+at|open|access)\b/i,
  /\bsend\s+me\s+the\b/i,
];

function normalizeKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasHumanDataRequest(text: string): boolean {
  return HUMAN_DATA_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

function isInventoryEvidenceTool(toolName: string): boolean {
  const normalized = toolName.trim();
  return (
    normalized.length > 0 && !NON_QUERY_TOOL_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function trimEvidence(now: number): void {
  for (const [key, evidence] of evidenceByRunId) {
    if (now - evidence.observedAt > TOOL_EVIDENCE_TTL_MS) {
      evidenceByRunId.delete(key);
    }
  }
  for (const [key, evidence] of evidenceBySessionKey) {
    if (now - evidence.observedAt > TOOL_EVIDENCE_TTL_MS) {
      evidenceBySessionKey.delete(key);
    }
  }
  while (evidenceByRunId.size > MAX_EVIDENCE_ENTRIES) {
    const oldestKey = evidenceByRunId.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    evidenceByRunId.delete(oldestKey);
  }
  while (evidenceBySessionKey.size > MAX_EVIDENCE_ENTRIES) {
    const oldestKey = evidenceBySessionKey.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    evidenceBySessionKey.delete(oldestKey);
  }
}

export function recordReplyToolInventoryEvidence(params: {
  toolName: string;
  runId?: string;
  sessionKey?: string;
  now?: number;
}): void {
  if (!isInventoryEvidenceTool(params.toolName)) {
    return;
  }
  const runId = normalizeKey(params.runId);
  const sessionKey = normalizeKey(params.sessionKey);
  if (!runId && !sessionKey) {
    return;
  }
  const now = params.now ?? Date.now();
  const evidence = { toolName: params.toolName, observedAt: now };
  trimEvidence(now);
  if (runId) {
    evidenceByRunId.set(runId, evidence);
  }
  if (sessionKey) {
    evidenceBySessionKey.set(sessionKey, evidence);
  }
}

export function evaluateReplyToolInventoryGuard(params: {
  channelId?: string;
  content?: string;
  runId?: string;
  sessionKey?: string;
  now?: number;
}): ReplyToolInventoryGuardDecision {
  if (params.channelId?.toLowerCase() !== "telegram") {
    return { ok: true };
  }
  const content = params.content?.trim() ?? "";
  if (!content || !hasHumanDataRequest(content)) {
    return { ok: true };
  }
  const now = params.now ?? Date.now();
  trimEvidence(now);
  const runId = normalizeKey(params.runId);
  const sessionKey = normalizeKey(params.sessionKey);
  if (
    (runId && evidenceByRunId.has(runId)) ||
    (sessionKey && evidenceBySessionKey.has(sessionKey))
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      "tool-inventory guard: Telegram reply asks the user for paste/access/check data before any same-turn tool query; inspect available tools first.",
  };
}

export function clearReplyToolInventoryEvidenceForTest(): void {
  evidenceByRunId.clear();
  evidenceBySessionKey.clear();
}
