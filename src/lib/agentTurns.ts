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
};

export type AgentTurnOutput =
  | { kind: "summary"; text: string }
  | { kind: "question"; text: string }
  | { kind: "none" };

export type AgentTurn = {
  id: string;
  index: number;
  prompt: string;
  steps: AgentStepLike[];
  output: AgentTurnOutput;
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

function outputFromSteps(steps: AgentStepLike[]): AgentTurnOutput {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.kind === "thought") {
      const text = String(step.payload?.text ?? "").trim();
      if (text) return { kind: "summary", text };
    }
    if (step.kind === "approval_request") {
      const text =
        typeof step.payload?.question === "string"
          ? step.payload.question.trim()
          : "";
      if (text) return { kind: "question", text };
    }
    if (step.kind === "tool_result") {
      const text = String(step.payload?.content ?? "").trim();
      if (text) return { kind: "summary", text };
    }
  }
  return { kind: "none" };
}

function outputForLatestTurn(
  run: AgentRunLike,
  steps: AgentStepLike[],
): AgentTurnOutput {
  if (run.status === "waiting_for_user") {
    const q = pendingQuestion(run.result) ?? resultSummary(run.result);
    if (q.trim()) return { kind: "question", text: q.trim() };
    return { kind: "none" };
  }
  if (run.result) {
    const summary =
      typeof run.result.summary === "string" ? run.result.summary.trim() : "";
    if (summary) return { kind: "summary", text: summary };
  }
  if (run.error?.trim()) {
    return { kind: "summary", text: run.error.trim() };
  }
  // While still running, surface the latest thought as provisional output.
  if (isActiveStatus(run.status)) {
    return outputFromSteps(steps);
  }
  return outputFromSteps(steps);
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

  return buckets.map((bucket, index) => {
    const isLatest = index === buckets.length - 1;
    return {
      id: `turn-${index}`,
      index,
      prompt: bucket.prompt,
      steps: bucket.steps,
      output: isLatest
        ? outputForLatestTurn(run, bucket.steps)
        : outputFromSteps(bucket.steps),
      isLatest,
      activeStepId: activeStepIdFor(bucket.steps, run.status, isLatest),
    };
  });
}
