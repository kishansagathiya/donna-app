import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PendingAttachment } from '../lib/chatAttachments';
import {
  buildAgentTurns,
  canReply,
  isPendingAgentRunId,
  mergeAgentRuns,
  parseAllowMultiple,
  parseOptions,
  PENDING_AGENT_RUN_ID,
  upsertAgentRun,
} from '../lib/agentTurns';
import {
  cancelAgentRun,
  createAgentRun,
  finishAgentRun,
  getAgentRun,
  listAgentRuns,
  listAgentSteps,
  redirectAgentRun,
  type AgentRun,
  type AgentStep,
} from '../services/agentsApi';

function attachmentPayloads(attachments: PendingAttachment[]) {
  return attachments.map(a => a.payload);
}

function makePendingAgentRun(goal: string): AgentRun {
  const now = new Date().toISOString();
  return {
    id: PENDING_AGENT_RUN_ID,
    user_id: '',
    goal,
    status: 'queued',
    max_steps: 0,
    step_count: 0,
    created_at: now,
    updated_at: now,
  };
}

export function useAgentSession(enabled = true) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const listFetchGen = useRef(0);

  const refreshRuns = useCallback(async () => {
    const gen = ++listFetchGen.current;
    try {
      const list = await listAgentRuns();
      if (gen !== listFetchGen.current) {
        return;
      }
      setRuns(prev => mergeAgentRuns(list, prev, selectedIdRef.current));
    } catch (e) {
      if (gen !== listFetchGen.current) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    }
  }, []);

  const refreshSelectedRun = useCallback(async (id: string) => {
    if (!id || isPendingAgentRunId(id)) {
      return;
    }
    try {
      const run = await getAgentRun(id);
      setRuns(prev => upsertAgentRun(prev, run));
    } catch {
      // List polling still updates history.
    }
  }, []);

  const refreshSteps = useCallback(async (id: string) => {
    try {
      const list = await listAgentSteps(id);
      setSteps(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load steps');
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refreshRuns();
  }, [enabled, refreshRuns]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!selectedId || isPendingAgentRunId(selectedId)) {
      if (!isPendingAgentRunId(selectedId)) {
        setSteps([]);
      }
      return;
    }
    void refreshSelectedRun(selectedId);
    void refreshSteps(selectedId);
    const timer = setInterval(() => {
      void refreshSelectedRun(selectedId);
      void refreshRuns();
      void refreshSteps(selectedId);
    }, 2500);
    return () => clearInterval(timer);
  }, [enabled, selectedId, refreshRuns, refreshSelectedRun, refreshSteps]);

  const active = runs.find(r => r.id === selectedId) ?? null;
  const turns = useMemo(
    () => (active ? buildAgentTurns(active, steps) : []),
    [active, steps],
  );
  const needsReply = Boolean(
    active?.status === 'waiting_for_user' ||
      turns[turns.length - 1]?.question?.live,
  );
  const options = useMemo(
    () => (needsReply ? parseOptions(active?.result) : []),
    [needsReply, active?.result],
  );
  const allowMultiple = Boolean(
    needsReply && parseAllowMultiple(active?.result),
  );
  const waitingWithOptions = Boolean(needsReply && options.length > 0);
  const showInput =
    !active || (canReply(active.status) && active.status !== 'cancelled');

  const optionKey = options.map(o => o.id).join('|');
  useEffect(() => {
    setSelectedOptions([]);
  }, [optionKey, selectedId]);

  async function createRun(
    goal: string,
    attachments: PendingAttachment[] = [],
  ) {
    const g = goal.trim();
    if ((!g && attachments.length === 0) || busyRef.current) {
      return;
    }
    const labels = attachments.map(a => a.filename).join(', ');
    const goalText = g || (labels ? `See attached: ${labels}` : 'See attached');
    setBusy(true);
    setError(null);
    setSteps([]);
    setRuns(prev => upsertAgentRun(prev, makePendingAgentRun(goalText)));
    setSelectedId(PENDING_AGENT_RUN_ID);
    try {
      const run = await createAgentRun(
        goalText,
        attachments.length > 0 ? attachmentPayloads(attachments) : undefined,
      );
      listFetchGen.current += 1;
      setRuns(prev =>
        upsertAgentRun(
          prev.filter(r => !isPendingAgentRunId(r.id)),
          run,
        ),
      );
      setSelectedId(id => (id === PENDING_AGENT_RUN_ID ? run.id : id));
      await refreshRuns();
      if (selectedIdRef.current === run.id) {
        await refreshSteps(run.id);
      }
    } catch (e) {
      setRuns(prev => prev.filter(r => !isPendingAgentRunId(r.id)));
      setSelectedId(id => (id === PENDING_AGENT_RUN_ID ? null : id));
      setError(e instanceof Error ? e.message : 'Failed to start agent');
    } finally {
      setBusy(false);
    }
  }

  async function replyToRun(
    id: string,
    message: string,
    attachments: PendingAttachment[] = [],
  ) {
    const msg = message.trim();
    if ((!msg && attachments.length === 0) || busyRef.current) {
      return;
    }
    const labels = attachments.map(a => a.filename).join(', ');
    const replyText =
      msg || (labels ? `See attached: ${labels}` : 'See attached');
    setBusy(true);
    setError(null);
    try {
      const updated = await redirectAgentRun(
        id,
        replyText,
        attachments.length > 0 ? attachmentPayloads(attachments) : undefined,
      );
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      setSelectedOptions([]);
      await refreshRuns();
      await refreshSteps(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  function composeWithOptions(text: string): string {
    const labels = options
      .filter(o => selectedOptions.includes(o.id))
      .map(o => o.label);
    if (labels.length === 0) {
      return text.trim();
    }
    const choice = labels.join(', ');
    const extra = text.trim();
    return extra ? `${choice}\n\n${extra}` : choice;
  }

  async function handleSend(
    text: string,
    attachments: PendingAttachment[] = [],
  ) {
    const composed = composeWithOptions(text);
    const canContinue =
      Boolean(active) &&
      Boolean(selectedId) &&
      !isPendingAgentRunId(selectedId) &&
      showInput;
    if (canContinue && selectedId) {
      await replyToRun(selectedId, composed, attachments);
    } else {
      await createRun(composed, attachments);
    }
  }

  async function onCancel(id: string) {
    setBusy(true);
    try {
      const updated = await cancelAgentRun(id);
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  async function onFinish(id: string) {
    setBusy(true);
    try {
      const updated = await finishAgentRun(id);
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      await refreshRuns();
      await refreshSteps(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark finished');
    } finally {
      setBusy(false);
    }
  }

  const handleNewRun = useCallback(() => {
    setSelectedId(null);
    setSteps([]);
    setSelectedOptions([]);
    setError(null);
    setRuns(prev => prev.filter(r => !isPendingAgentRunId(r.id)));
  }, []);

  function toggleOption(id: string) {
    setSelectedOptions(prev => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      }
      return prev[0] === id ? [] : [id];
    });
  }

  const allowEmptySend = waitingWithOptions && selectedOptions.length > 0;
  const isPending = isPendingAgentRunId(active?.id);

  return {
    runs,
    selectedId,
    setSelectedId,
    steps,
    busy,
    error,
    setError,
    selectedOptions,
    active,
    turns,
    needsReply,
    options,
    allowMultiple,
    waitingWithOptions,
    showInput,
    handleSend,
    onCancel,
    onFinish,
    handleNewRun,
    composeWithOptions,
    toggleOption,
    allowEmptySend,
    isPending,
    refreshRuns,
  };
}
