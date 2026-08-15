/** Pure helpers to group agent steps into Cursor-style turns. */

export type AgentStepLike = {
  id: string;
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
};

export type AgentRunLike = {
  goal: string;
  status: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  redirect_pending?: string | null;
};

export type AgentTurnOutput =
  | { kind: "summary"; text: string }
  | { kind: "none" };

export type AgentTurnQuestion = {
  text: string;
  /** True only while this turn is waiting for a reply. */
  live: boolean;
};

export type AgentTurn = {
  id: string;
  index: number;
  prompt: string;
  steps: AgentStepLike[];
  output: AgentTurnOutput;
  question: AgentTurnQuestion | null;
  isLatest: boolean;
  /** Highest-seq non-user step in the latest turn while run is active. */
  activeStepId: string | null;
};

export type AskOption = { id: string; label: string };

export function isFinishedStatus(status: string): boolean {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

export function isActiveStatus(status: string): boolean {
  return status === "running" || status === "queued";
}

export function canReply(status: string): boolean {
  return (
    status === "waiting_for_user" ||
    status === "running" ||
    status === "queued" ||
    status === "succeeded" ||
    status === "failed"
  );
}

/** Put `run` at the front of the list, replacing any previous copy. */
export function upsertAgentRun<T extends { id: string }>(runs: T[], run: T): T[] {
  return [run, ...runs.filter((r) => r.id !== run.id)];
}

export function resultSummary(
  result: Record<string, unknown> | null | undefined,
): string {
  if (!result) return "";
  if (typeof result.summary === "string" && result.summary.trim()) {
    return result.summary;
  }
  if (typeof result.question === "string" && result.question.trim()) {
    return result.question;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function pendingQuestion(
  result: Record<string, unknown> | null | undefined,
): string | null {
  if (!result) return null;
  if (typeof result.question === "string" && result.question.trim()) {
    return result.question.trim();
  }
  if (
    result.kind === "ask_user" &&
    typeof result.summary === "string" &&
    result.summary.trim()
  ) {
    return result.summary.trim();
  }
  if (
    typeof result.summary === "string" &&
    result.summary.trim() &&
    String(result.kind ?? "").includes("ask")
  ) {
    return result.summary.trim();
  }
  return null;
}

export function parseOptions(
  result: Record<string, unknown> | null | undefined,
): AskOption[] {
  if (!result) return [];
  const raw = result.options ?? (result.args as { options?: unknown } | undefined)?.options;
  if (!Array.isArray(raw)) return [];
  const out: AskOption[] = [];
  raw.forEach((item, i) => {
    if (typeof item === "string" && item.trim()) {
      out.push({ id: `opt_${i + 1}`, label: item.trim() });
      return;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const label = String(obj.label ?? obj.text ?? "").trim();
      if (!label) return;
      const id = String(obj.id ?? `opt_${i + 1}`).trim() || `opt_${i + 1}`;
      out.push({ id, label });
    }
  });
  return out;
}

export function stepTitle(step: AgentStepLike): string {
  const p = step.payload || {};
  switch (step.kind) {
    case "status":
      return String(p.text ?? "status");
    case "thought":
      return "Thought";
    case "tool_call":
      return `Tool → ${String(p.name ?? "tool")}`;
    case "tool_result":
      return `Result ← ${String(p.name ?? "tool")}`;
    case "user_message":
      return "Reply";
    case "approval_request":
      return p.kind === "ask_user" || p.tool === "ask_user"
        ? "Question for you"
        : "Approval requested";
    case "error":
      return "Error";
    case "compress":
      return "Context compressed";
    case "memory_retrieve":
      return "Memory";
    default:
      return step.kind;
  }
}

export function stepBody(step: AgentStepLike): string {
  const p = step.payload || {};
  switch (step.kind) {
    case "status":
      return String(p.text ?? "");
    case "thought":
      return String(p.text ?? "");
    case "tool_call": {
      const args = p.args;
      if (args == null) return "";
      if (typeof args === "string") return args;
      try {
        return JSON.stringify(args, null, 2);
      } catch {
        return String(args);
      }
    }
    case "tool_result":
      return String(p.content ?? "");
    case "user_message":
      return String(p.message ?? "");
    case "approval_request":
      if (typeof p.question === "string" && p.question.trim()) {
        return p.question;
      }
      try {
        return JSON.stringify(p, null, 2);
      } catch {
        return String(p);
      }
    case "error":
      return String(p.error ?? "");
    default:
      try {
        return JSON.stringify(p, null, 2);
      } catch {
        return "";
      }
  }
}

function userMessageText(step: AgentStepLike): string {
  const msg = step.payload?.message;
  return typeof msg === "string" ? msg : String(msg ?? "");
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim() === b.trim());
}

/** Final assistant text that is really a question, not a finished answer. */
export function looksLikeQuestion(text: string): boolean {
  const s = text.trim();
  if (s.length < 12) return false;
  const lower = s.toLowerCase();
  const cues = [
    "could you",
    "can you",
    "would you",
    "please clarify",
    "please confirm",
    "please provide",
    "please tell",
    "i need to know",
    "i need more",
    "which one",
    "what date",
    "what time",
    "do you want",
    "do you prefer",
    "let me know",
    "reply with",
    "need your",
    "before i continue",
    "before i proceed",
    "to proceed",
    "to continue",
  ];
  if (cues.some((cue) => lower.includes(cue))) return true;
  return (
    s.endsWith("?") &&
    /\b(you|your|which|what|when|where|why|how)\b/.test(lower)
  );
}

export function splitTrailingQuestion(text: string): {
  body: string | null;
  question: string | null;
} {
  const s = text.trim();
  if (!s) return { body: null, question: null };
  const match = s.match(/([^.!?\n][^.!?\n]*\?)\s*$/);
  if (!match) {
    return looksLikeQuestion(s) ? { body: null, question: s } : { body: s, question: null };
  }
  const question = match[1].trim();
  const body = s.slice(0, s.length - match[0].length).trim();
  if (!looksLikeQuestion(question) && !looksLikeQuestion(s)) {
    return { body: s, question: null };
  }
  return { body: body || null, question };
}

function questionFromSteps(steps: AgentStepLike[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== "approval_request") continue;
    const text =
      typeof steps[i].payload?.question === "string"
        ? steps[i].payload.question.trim()
        : "";
    if (text) return text;
  }
  return null;
}

function thoughtAsOutput(text: string, excludeText: string | null): AgentTurnOutput | null {
  if (!text || sameText(text, excludeText)) return null;
  const split = splitTrailingQuestion(text);
  if (split.body && !sameText(split.body, excludeText)) {
    return { kind: "summary", text: split.body };
  }
  if (looksLikeQuestion(text) && !split.body) return null;
  return { kind: "summary", text };
}

function workOutputFromSteps(
  steps: AgentStepLike[],
  excludeText: string | null,
): AgentTurnOutput {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== "thought") continue;
    const found = thoughtAsOutput(String(steps[i].payload?.text ?? "").trim(), excludeText);
    if (found) return found;
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== "tool_result") continue;
    const text = String(steps[i].payload?.content ?? "").trim();
    if (text && !sameText(text, excludeText) && !looksLikeQuestion(text)) {
      return { kind: "summary", text };
    }
  }
  return { kind: "none" };
}

function lastThoughtText(steps: AgentStepLike[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== "thought") continue;
    const text = String(steps[i].payload?.text ?? "").trim();
    if (text) return text;
  }
  return null;
}

function resultSummaryText(run: AgentRunLike): string {
  return typeof run.result?.summary === "string" ? run.result.summary.trim() : "";
}

function closedByUser(result: Record<string, unknown> | null | undefined): boolean {
  return result?.closed_by_user === true;
}

function hasApprovalRequest(steps: AgentStepLike[]): boolean {
  return steps.some((step) => step.kind === "approval_request");
}

function artifactsForTurn(
  run: AgentRunLike,
  steps: AgentStepLike[],
  isLatest: boolean,
  leftoverBelongsToPrevious: boolean,
  isPrevious: boolean,
): { output: AgentTurnOutput; question: AgentTurnQuestion | null } {
  const stepQuestion = questionFromSteps(steps);
  const thoughtSplit = splitTrailingQuestion(lastThoughtText(steps) ?? "");
  const resultQuestion = pendingQuestion(run.result);
  const resultSummary = resultSummaryText(run);
  const resultSplit = splitTrailingQuestion(resultSummary);
  const skipped = closedByUser(run.result);
  if (isLatest && (isActiveStatus(run.status) || leftoverBelongsToPrevious)) {
    return { output: { kind: "none" }, question: null };
  }

  let questionText: string | null = stepQuestion ?? thoughtSplit.question;
  if (isLatest && !leftoverBelongsToPrevious) {
    questionText =
      resultQuestion ??
      stepQuestion ??
      thoughtSplit.question ??
      resultSplit.question;
  } else if (isPrevious && leftoverBelongsToPrevious) {
    questionText = stepQuestion ?? thoughtSplit.question ?? resultQuestion;
  }

  const waiting =
    run.status === "waiting_for_user" ||
    (isLatest &&
      Boolean(questionText) &&
      !skipped &&
      (run.status === "succeeded" || run.status === "failed"));

  const question: AgentTurnQuestion | null = questionText
    ? {
        text: questionText,
        live: Boolean(isLatest && waiting && !leftoverBelongsToPrevious && !skipped),
      }
    : null;

  const exclude = question?.text ?? resultQuestion ?? stepQuestion;
  let output = workOutputFromSteps(steps, exclude);
  const fromResult = thoughtAsOutput(resultSummary, exclude);

  if (isPrevious && leftoverBelongsToPrevious && fromResult) {
    output = fromResult;
  }

  if (
    isLatest &&
    !isActiveStatus(run.status) &&
    run.status !== "waiting_for_user"
  ) {
    if (fromResult) {
      output = fromResult;
    } else if (output.kind === "none" && run.error?.trim()) {
      output = { kind: "summary", text: run.error.trim() };
    }
  }

  if (isLatest && run.status === "waiting_for_user" && fromResult) {
    output = fromResult;
  }

  return { output, question };
}

function pendingRedirectPrompt(
  run: AgentRunLike,
  ordered: AgentStepLike[],
): string | null {
  const pending =
    typeof run.redirect_pending === "string" ? run.redirect_pending.trim() : "";
  if (!pending) return null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].kind !== "user_message") continue;
    if (userMessageText(ordered[i]) === pending) return null;
    break;
  }
  return pending;
}

function activeStepIdFor(
  steps: AgentStepLike[],
  status: string,
  isLatest: boolean,
): string | null {
  if (!isLatest || !isActiveStatus(status) || steps.length === 0) return null;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== "user_message") return steps[i].id;
  }
  return null;
}

/**
 * Split a run into chronological turns:
 * Turn 0 = goal + steps until first user_message;
 * later turns start at each user_message.
 */
export function buildAgentTurns(
  run: AgentRunLike,
  steps: AgentStepLike[],
): AgentTurn[] {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);
  const buckets: { prompt: string; steps: AgentStepLike[] }[] = [
    { prompt: run.goal, steps: [] },
  ];

  for (const step of ordered) {
    if (step.kind === "user_message") {
      buckets.push({ prompt: userMessageText(step), steps: [] });
      continue;
    }
    buckets[buckets.length - 1].steps.push(step);
  }

  const pending = pendingRedirectPrompt(run, ordered);
  if (pending) {
    buckets.push({ prompt: pending, steps: [] });
  }

  const latestSteps = buckets[buckets.length - 1]?.steps ?? [];
  const leftoverBelongsToPrevious =
    buckets.length > 1 &&
    (isActiveStatus(run.status) ||
      (run.status === "waiting_for_user" && !hasApprovalRequest(latestSteps)));

  return buckets.map((bucket, index) => {
    const isLatest = index === buckets.length - 1;
    const isPrevious = index === buckets.length - 2;
    const { output, question } = artifactsForTurn(
      run,
      bucket.steps,
      isLatest,
      leftoverBelongsToPrevious,
      isPrevious,
    );
    return {
      id: `turn-${index}`,
      index,
      prompt: bucket.prompt,
      steps: bucket.steps,
      output,
      question,
      isLatest,
      activeStepId: activeStepIdFor(bucket.steps, run.status, isLatest),
    };
  });
}
