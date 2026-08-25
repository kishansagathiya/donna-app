/**
 * @jest-environment node
 */

import {
  approvalKindLabel,
  bookingProposalFromResult,
  buildAgentTurns,
  canReply,
  isApprovalPause,
  parseAllowMultiple,
  parseOptions,
  pendingQuestion,
  stepBody,
  stepTitle,
  timelineSteps,
  shouldCollapseTurnSteps,
  upsertAgentRun,
  type AgentRunLike,
  type AgentStepLike,
} from "../agentTurns";

function step(
  partial: Partial<AgentStepLike> & Pick<AgentStepLike, "id" | "seq" | "kind">,
): AgentStepLike {
  return {
    payload: {},
    ...partial,
  };
}

const baseRun: AgentRunLike = {
  goal: "Find the Lisbon photo",
  status: "running",
  result: null,
};

describe("buildAgentTurns", () => {
  it("creates a single turn from goal with no steps", () => {
    const turns = buildAgentTurns(baseRun, []);
    expect(turns).toHaveLength(1);
    expect(turns[0].prompt).toBe("Find the Lisbon photo");
    expect(turns[0].steps).toEqual([]);
    expect(turns[0].isLatest).toBe(true);
    expect(turns[0].activeStepId).toBeNull();
    expect(turns[0].output).toEqual({ kind: "none" });
  });

  it("groups mid-run steps under the goal turn and highlights the active step", () => {
    const steps = [
      step({ id: "s1", seq: 1, kind: "status", payload: { text: "starting" } }),
      step({ id: "s2", seq: 2, kind: "tool_call", payload: { name: "search" } }),
      step({
        id: "s3",
        seq: 3,
        kind: "tool_result",
        payload: { name: "search", content: "found 2" },
      }),
    ];
    const turns = buildAgentTurns({ ...baseRun, status: "running" }, steps);
    expect(turns).toHaveLength(1);
    expect(turns[0].steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(turns[0].activeStepId).toBe("s3");
    expect(turns[0].output).toEqual({ kind: "none" });
  });

  it("keeps previous output before a follow-up and hides output while the follow-up is running", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Looking in Photos…" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Also check Dropbox" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "tool_call",
        payload: { name: "search_dropbox" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "running",
        result: { summary: "Found it in Photos" },
      },
      steps,
    );
    expect(turns).toHaveLength(2);

    expect(turns[0].prompt).toBe("Find the Lisbon photo");
    expect(turns[0].isLatest).toBe(false);
    expect(turns[0].output).toEqual({
      kind: "summary",
      text: "Found it in Photos",
    });

    expect(turns[1].prompt).toBe("Also check Dropbox");
    expect(turns[1].isLatest).toBe(true);
    expect(turns[1].steps.map((s) => s.id)).toEqual(["s3"]);
    expect(turns[1].activeStepId).toBe("s3");
    expect(turns[1].output).toEqual({ kind: "none" });
  });

  it("opens a pending follow-up turn before the user_message step is recorded", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Looking…" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "queued",
        result: { summary: "Found it in Photos" },
        redirect_pending: "Also check Dropbox",
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[0].output).toEqual({
      kind: "summary",
      text: "Found it in Photos",
    });
    expect(turns[1].prompt).toBe("Also check Dropbox");
    expect(turns[1].steps).toEqual([]);
    expect(turns[1].output).toEqual({ kind: "none" });
    expect(turns[1].isLatest).toBe(true);
  });

  it("keeps a follow-up's result on that follow-up prompt, not an earlier one", () => {
    const first = "Found it in Photos.";
    const second = "Also found a copy in Dropbox.";
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: first },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Check Dropbox too" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "thought",
        payload: { text: second },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "waiting_for_user",
        result: { summary: second },
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[0].prompt).toBe("Find the Lisbon photo");
    expect(turns[0].output).toEqual({ kind: "summary", text: first });
    expect(turns[1].prompt).toBe("Check Dropbox too");
    expect(turns[1].output).toEqual({ kind: "summary", text: second });
  });

  it("does not pin a finished follow-up answer on the previous prompt while status is still running", () => {
    const first = "Found it in Photos.";
    const second = "Also found a copy in Dropbox.";
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: first },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Check Dropbox too" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "thought",
        payload: { text: second },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "running",
        result: { summary: second },
      },
      steps,
    );
    expect(turns[0].output).toEqual({ kind: "summary", text: first });
    expect(turns[1].prompt).toBe("Check Dropbox too");
    expect(turns[1].output).toEqual({ kind: "none" });
  });

  it("keeps a leftover question on the previous turn after the user replies", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Travel" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "status",
        payload: { text: "searching" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "running",
        result: {
          kind: "ask_user",
          question: "Which album should I search?",
        },
      },
      steps,
    );
    expect(turns[0].output).toEqual({ kind: "none" });
    expect(turns[0].question).toEqual({
      text: "Which album?",
      live: false,
    });
    expect(turns[1].prompt).toBe("Travel");
    expect(turns[1].output).toEqual({ kind: "none" });
    expect(turns[1].question).toBeNull();
  });

  it("keeps work output visible when a turn also asks a question", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Found two albums." },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "user_message",
        payload: { message: "Travel" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "waiting_for_user",
        result: {
          kind: "ask_user",
          question: "Which album should I search?",
        },
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[0].output).toEqual({
      kind: "summary",
      text: "Found two albums.",
    });
    expect(turns[0].question).toEqual({
      text: "Which album?",
      live: false,
    });
    expect(turns[1].prompt).toBe("Travel");
    expect(turns[1].output).toEqual({ kind: "none" });
    expect(turns[1].question).toBeNull();
  });

  it("splits on user_message redirects into multiple turns", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Looking…" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Also check Dropbox" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "tool_call",
        payload: { name: "search_dropbox" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "succeeded",
        result: { summary: "Found it in Dropbox" },
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[0].prompt).toBe("Find the Lisbon photo");
    expect(turns[0].steps.map((s) => s.id)).toEqual(["s1"]);
    expect(turns[0].output).toEqual({ kind: "summary", text: "Looking…" });
    expect(turns[0].isLatest).toBe(false);
    expect(turns[0].activeStepId).toBeNull();

    expect(turns[1].prompt).toBe("Also check Dropbox");
    expect(turns[1].steps.map((s) => s.id)).toEqual(["s3"]);
    expect(turns[1].isLatest).toBe(true);
    expect(turns[1].activeStepId).toBeNull();
    expect(turns[1].output).toEqual({
      kind: "summary",
      text: "Found it in Dropbox",
    });
  });

  it("uses waiting question on the latest turn only", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Need clarity" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Use my notes" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "waiting_for_user",
        result: {
          kind: "ask_user",
          question: "Which album should I search?",
          options: ["Travel", "Family"],
        },
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[0].output).toEqual({ kind: "summary", text: "Need clarity" });
    expect(turns[0].question).toBeNull();
    expect(turns[1].output).toEqual({ kind: "none" });
    expect(turns[1].question).toEqual({
      text: "Which album should I search?",
      live: true,
    });
    expect(turns[1].activeStepId).toBeNull();
  });

  it("puts the follow-up result at the end instead of the previous question", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "Travel" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "thought",
        payload: { text: "Here are the Travel album photos." },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "succeeded",
        result: { summary: "Here are the Travel album photos." },
      },
      steps,
    );
    expect(turns[0].output).toEqual({ kind: "none" });
    expect(turns[0].question).toEqual({
      text: "Which album?",
      live: false,
    });
    expect(turns[1].isLatest).toBe(true);
    expect(turns[1].output).toEqual({
      kind: "summary",
      text: "Here are the Travel album photos.",
    });
    expect(turns[1].question).toBeNull();
  });

  it("shows work output above a live question on the same turn", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Found two albums." },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "waiting_for_user",
        result: {
          kind: "ask_user",
          question: "Which album should I search?",
          summary: "Which album should I search?",
        },
      },
      steps,
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].output).toEqual({
      kind: "summary",
      text: "Found two albums.",
    });
    expect(turns[0].question).toEqual({
      text: "Which album should I search?",
      live: true,
    });
  });

  it("shows a summary after the user marks a waiting run finished", () => {
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: "Found two albums." },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "approval_request",
        payload: { kind: "ask_user", question: "Which album?" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "status",
        payload: { text: "Marked finished by user.", kind: "user_finished" },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "succeeded",
        result: {
          kind: "ask_user",
          question: "Which album should I search?",
          summary: "Which album should I search?",
          closed_by_user: true,
        },
      },
      steps,
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].output).toEqual({
      kind: "summary",
      text: "Found two albums.",
    });
    expect(turns[0].question).toEqual({
      text: "Which album should I search?",
      live: false,
    });
  });

  it("uses earlier work as Output when the last thought is a question", () => {
    const assessment =
      "My Honest Assessment\n\nStrengths: distribution.\n\nBottom line: the wedge can work.";
    const question = "What angle are you considering getting into this space from?";
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: assessment },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "user_message",
        payload: { message: "is this a good space to get into?" },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "thought",
        payload: { text: assessment },
      }),
      step({
        id: "s4",
        seq: 4,
        kind: "thought",
        payload: { text: question },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "succeeded",
        result: { summary: question },
      },
      steps,
    );
    expect(turns).toHaveLength(2);
    expect(turns[1].output).toEqual({ kind: "summary", text: assessment });
    expect(turns[1].question).toEqual({ text: question, live: true });
  });

  it("splits a trailing question off a long thought", () => {
    const body = "The space is crowded but the wedge is real.";
    const question = "What angle are you considering getting into this space from?";
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "thought",
        payload: { text: `${body}\n\n${question}` },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "succeeded",
        result: { summary: `${body}\n\n${question}` },
      },
      steps,
    );
    expect(turns[0].output).toEqual({ kind: "summary", text: body });
    expect(turns[0].question).toEqual({ text: question, live: true });
  });

  it("sorts steps by seq even if input is unsorted", () => {
    const steps = [
      step({ id: "s2", seq: 2, kind: "thought", payload: { text: "b" } }),
      step({ id: "s1", seq: 1, kind: "thought", payload: { text: "a" } }),
    ];
    const turns = buildAgentTurns(baseRun, steps);
    expect(turns[0].steps.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("keeps result and follow-up question out of the step timeline", () => {
    const assessment = "Found two albums in Photos.";
    const question = "Which album should I search?";
    const steps = [
      step({
        id: "s1",
        seq: 1,
        kind: "tool_call",
        payload: { name: "search" },
      }),
      step({
        id: "s2",
        seq: 2,
        kind: "thought",
        payload: { text: assessment },
      }),
      step({
        id: "s3",
        seq: 3,
        kind: "approval_request",
        payload: { kind: "ask_user", question },
      }),
    ];
    const turns = buildAgentTurns(
      {
        ...baseRun,
        status: "waiting_for_user",
        result: { kind: "ask_user", question, summary: question },
      },
      steps,
    );
    expect(turns[0].output).toEqual({ kind: "summary", text: assessment });
    expect(turns[0].question?.text).toBe(question);
    expect(timelineSteps(turns[0]).map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("shouldCollapseTurnSteps", () => {
  const settled = {
    isLatest: false,
    output: { kind: "summary" as const, text: "done" },
    question: null,
  };

  it("collapses a previous turn that already has output while a follow-up runs", () => {
    expect(shouldCollapseTurnSteps(settled, "running")).toBe(true);
  });

  it("keeps the live turn expanded while the run is active", () => {
    expect(
      shouldCollapseTurnSteps({ ...settled, isLatest: true }, "running"),
    ).toBe(false);
  });

  it("collapses the latest turn once it has output and is no longer running", () => {
    expect(
      shouldCollapseTurnSteps({ ...settled, isLatest: true }, "succeeded"),
    ).toBe(true);
    expect(
      shouldCollapseTurnSteps(
        {
          isLatest: true,
          output: { kind: "none" },
          question: { text: "Which one?", live: true },
        },
        "waiting_for_user",
      ),
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("parses options and pending questions", () => {
    expect(
      parseOptions({ options: ["A", { id: "b", label: "B" }] }),
    ).toEqual([
      { id: "opt_1", label: "A" },
      { id: "b", label: "B" },
    ]);
    expect(
      parseOptions({
        options: ["A", "B", "C", "D", "E"],
      }).map((o) => o.label),
    ).toEqual(["A", "B", "C", "D"]);
    expect(parseAllowMultiple({ allow_multiple: true })).toBe(true);
    expect(parseAllowMultiple({ args: { allow_multiple: true } })).toBe(true);
    expect(parseAllowMultiple({ options: ["A", "B"] })).toBe(false);
    expect(pendingQuestion({ question: "Pick one" })).toBe("Pick one");
    expect(canReply("cancelled")).toBe(false);
    expect(canReply("succeeded")).toBe(true);
  });

  it("upserts a run to the front without duplicating", () => {
    const a = { id: "a", goal: "one" };
    const b = { id: "b", goal: "two" };
    const b2 = { id: "b", goal: "two-updated" };
    expect(upsertAgentRun([a], b)).toEqual([b, a]);
    expect(upsertAgentRun([a, b], b2)).toEqual([b2, a]);
  });

  it("formats step titles and bodies", () => {
    const call = step({
      id: "1",
      seq: 1,
      kind: "tool_call",
      payload: { name: "web", args: { q: "x" } },
    });
    expect(stepTitle(call)).toBe("Tool → web");
    expect(stepBody(call)).toContain('"q": "x"');

    const browse = step({
      id: "2",
      seq: 2,
      kind: "tool_call",
      payload: {
        name: "browse_page",
        args: { url: "https://example.com/form" },
      },
    });
    expect(stepTitle(browse)).toBe("Browse page · example.com");
  });

  it("detects irreversible approval pauses", () => {
    expect(isApprovalPause({ kind: "ask_user", question: "Which?" })).toBe(
      false,
    );
    expect(
      isApprovalPause({
        kind: "request_approval",
        args: { kind: "book_flight" },
      }),
    ).toBe(true);
    expect(
      approvalKindLabel({
        kind: "request_approval",
        args: { kind: "book_flight" },
      }),
    ).toBe("book flight");
    const proposal = bookingProposalFromResult({
      kind: "request_approval",
      args: {
        kind: "book_flight",
        details: {
          itinerary: "SFO→LIS",
          total: 842,
          currency: "USD",
          airline: "United",
        },
      },
    });
    expect(proposal?.itinerary).toBe("SFO→LIS");
    expect(proposal?.total).toBe("USD 842");
    expect(proposal?.airline).toBe("United");
  });
});
