/**
 * Host-facing controller for the scan → pause → choose → remediate workflow.
 * Owns attach/session state and operation actions; presentation is ProjectWorkflowPanel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApmeApi } from './api/apmeApiAdapter';
import {
  fetchProjectOperationState,
  LIVE_OPERATION_STATUSES,
  useProjectOperationState,
  type ProjectOperationState,
} from './hooks/useProjectOperationState';
import {
  SessionExpiredError,
  useProjectOperationActions,
  WorkingSetConflictError,
} from './hooks/useProjectOperationActions';
import type { AiEscalateTarget } from './components/AiEscalationPanel';
import { AI_MODEL_STORAGE_KEY } from './shared/constants';
import { listAiModels } from './api/listAiModels';
import type { ApmeApiAdapter } from './api/apmeApiAdapter';

export async function resolveAiModel(
  api: ApmeApiAdapter,
  getAiModel?: () => string | undefined,
): Promise<string> {
  let selectedModel: string | undefined;
  try {
    selectedModel = getAiModel?.();
    if (!selectedModel && typeof localStorage !== 'undefined') {
      selectedModel = localStorage.getItem(AI_MODEL_STORAGE_KEY) || undefined;
    }
  } catch {
    // Storage may be blocked by the browser; the model catalog can still supply a default.
  }

  let models;
  try {
    models = await listAiModels(api);
  } catch {
    throw new Error('Could not verify an AI model. Check AI provider availability and try again.');
  }
  if (selectedModel && models.some((model) => model.id === selectedModel)) {
    return selectedModel;
  }
  const fallbackModel = models[0]?.id;
  if (fallbackModel) return fallbackModel;
  throw new Error('No AI model is available. Check the AI provider configuration and try again.');
}

export interface ProjectWorkflowCheckOptions {
  ansibleVersion: string;
  /** Comma-separated collection specs. */
  collections: string;
  enableAi: boolean;
  autoApplyTier1: boolean;
}

export interface UseProjectWorkflowOptions {
  checkOptions: ProjectWorkflowCheckOptions;
  /** Resolve AI model id when enableAi (e.g. localStorage). */
  getAiModel?: () => string | undefined;
  /** Start attached (e.g. ?resume=1). */
  initiallyAttached?: boolean;
  /** Notify host when Session should become the active tab. */
  onOpenSession?: () => void;
  /** Notify host when Session is dismissed back to Overview. */
  onDismissSession?: () => void;
}

export interface ProjectWorkflowController {
  attachOp: boolean;
  setAttachOp: (v: boolean) => void;
  opState: ProjectOperationState | null;
  isRunning: boolean;
  /** True while POST cancel is in flight (op snapshot may clear before dismiss). */
  isCancelling: boolean;
  operationActive: boolean;
  sessionTabVisible: boolean;
  refreshOp: () => void;
  clearOp: () => void;
  startScan: () => Promise<void>;
  beginRemediate: () => Promise<void>;
  escalateAi: (targets: AiEscalateTarget[]) => Promise<void>;
  approve: ReturnType<typeof useProjectOperationActions>['approve'];
  cancel: () => Promise<void>;
  createPR: ReturnType<typeof useProjectOperationActions>['createPR'];
  patchProposals: ReturnType<typeof useProjectOperationActions>['patchProposals'];
  dismiss: () => void;
  resumeSession: () => void;
  startOver: () => Promise<void>;
  /** Latest history scan_id that matches a live op (for Resume UI). */
  findResumableScanId: (
    latestScanId: string | undefined,
  ) => Promise<string | null>;
}

export function useProjectWorkflow(
  projectId: string,
  options: UseProjectWorkflowOptions,
): ProjectWorkflowController {
  const {
    checkOptions,
    getAiModel,
    initiallyAttached = false,
    onOpenSession,
    onDismissSession,
  } = options;
  const { ansibleVersion, collections, enableAi, autoApplyTier1 } = checkOptions;

  const api = useApmeApi();

  const [attachOp, setAttachOp] = useState(initiallyAttached);
  const [isCancelling, setIsCancelling] = useState(false);
  /** Bumped when session dismissed or replaced so stale cancelOp() completions are ignored. */
  const cancelGenerationRef = useRef(0);
  /** operation_id for the attached session — gates server-side auto-dismiss on cancelled. */
  const trackedOpIdRef = useRef<string | null>(null);

  const { state: opState, refresh: refreshOp, clear: clearOp, applyLocalApprovalAck } =
    useProjectOperationState(projectId, {
      enabled: Boolean(projectId) && attachOp,
    });

  // Resume (?resume=1 / initiallyAttached): if Gateway has no live op (404),
  // detach so hosts do not keep a permanent "Starting scan…" Session tab.
  // Probe failures must not detach — a transient Gateway error can hide a
  // real in-flight operation (Dismiss remains available on the loading panel).
  useEffect(() => {
    if (!initiallyAttached || !projectId) return;
    let cancelled = false;
    fetchProjectOperationState(projectId, api)
      .then((op) => {
        if (cancelled || op) return;
        setAttachOp(false);
        onDismissSession?.();
      })
      .catch(() => {
        /* keep attached on probe failure */
      });
    return () => {
      cancelled = true;
    };
  }, [initiallyAttached, projectId, api, onDismissSession]);

  const {
    start: startOp,
    approve,
    beginRemediate: beginRemediateOp,
    cancel: cancelOp,
    createPR,
    patchProposals,
    escalateAi: escalateAiOp,
  } = useProjectOperationActions(projectId);

  const isRunning =
    isCancelling ||
    (opState != null && LIVE_OPERATION_STATUSES.has(opState.status));
  const operationActive =
    attachOp && opState != null && opState.status !== 'cancelled';
  const sessionTabVisible = attachOp;

  useEffect(() => {
    if (
      attachOp &&
      opState?.status === 'awaiting_ai_triage' &&
      opState.ai_triage_candidates === undefined
    ) {
      refreshOp();
    }
  }, [attachOp, opState?.status, opState?.ai_triage_candidates, refreshOp]);

  // Gate 2: proposals SSE can be missed while status stays applying — poll GET.
  useEffect(() => {
    if (!attachOp || !enableAi || opState?.status !== 'applying') {
      return;
    }
    if (opState.ai_triage_candidates === undefined) {
      return;
    }
    const timer = setInterval(() => {
      refreshOp();
    }, 3000);
    return () => clearInterval(timer);
  }, [
    attachOp,
    enableAi,
    opState?.status,
    opState?.ai_triage_candidates,
    refreshOp,
  ]);

  const approveWithState = useCallback(
    async (approvedIds: string[]) => {
      const result = await approve(approvedIds, opState?.approval_gate_id);
      applyLocalApprovalAck();
      return result;
    },
    [approve, applyLocalApprovalAck, opState?.approval_gate_id],
  );

  const invalidatePendingCancel = useCallback(() => {
    cancelGenerationRef.current += 1;
    setIsCancelling(false);
  }, []);

  const openSession = useCallback(() => {
    setAttachOp(true);
    onOpenSession?.();
  }, [onOpenSession]);

  const buildColls = useCallback(
    () =>
      collections
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [collections],
  );

  const startScan = useCallback(async () => {
    invalidatePendingCancel();
    clearOp();
    const scanGeneration = cancelGenerationRef.current;
    const colls = buildColls();
    let aiModel: string | undefined;
    try {
      aiModel = enableAi ? await resolveAiModel(api, getAiModel) : undefined;
    } catch (err) {
      if (scanGeneration !== cancelGenerationRef.current) return;
      console.error('Could not resolve AI model:', err);
      refreshOp();
      window.alert(err instanceof Error ? err.message : 'Could not verify an AI model.');
      return;
    }
    if (scanGeneration !== cancelGenerationRef.current) return;
    openSession();

    const startOnce = (abandonWorkingSet: boolean) =>
      startOp('check', {
        ansible_version: ansibleVersion || undefined,
        collection_specs: colls.length ? colls : undefined,
        enable_ai: enableAi,
        ai_model: aiModel,
        assess_pause: true,
        interactive: !autoApplyTier1,
        ...(abandonWorkingSet ? { abandon_working_set: true } : {}),
      });

    try {
      await startOnce(false);
      refreshOp();
    } catch (err) {
      if (err instanceof WorkingSetConflictError) {
        const ok = window.confirm(
          `${err.message}\n\nDiscard the draft working set and start a new scan?`,
        );
        if (ok) {
          try {
            await startOnce(true);
            refreshOp();
          } catch (retryErr) {
            console.error('Failed to start operation after abandon:', retryErr);
            window.alert(
              retryErr instanceof Error
                ? retryErr.message
                : 'Failed to start scan after discarding draft.',
            );
          }
        } else {
          refreshOp();
        }
        return;
      }
      console.error('Failed to start operation:', err);
      refreshOp();
      const msg = err instanceof Error ? err.message : 'Failed to start scan.';
      if (!/already has an active operation/i.test(msg)) {
        window.alert(msg);
      }
    }
  }, [
    ansibleVersion,
    autoApplyTier1,
    buildColls,
    enableAi,
    api,
    getAiModel,
    clearOp,
    invalidatePendingCancel,
    openSession,
    refreshOp,
    startOp,
  ]);

  const beginRemediate = useCallback(async () => {
    const generation = cancelGenerationRef.current;
    try {
      openSession();
      await beginRemediateOp();
      refreshOp();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        if (generation !== cancelGenerationRef.current) return;
        const ok = window.confirm(
          'Assessment session expired. Start a full remediate (rescan)?',
        );
        if (ok) {
          const colls = buildColls();
          let aiModel: string | undefined;
          try {
            aiModel = enableAi ? await resolveAiModel(api, getAiModel) : undefined;
          } catch (startErr) {
            if (generation !== cancelGenerationRef.current) return;
            console.error('Could not resolve AI model:', startErr);
            window.alert(
              startErr instanceof Error ? startErr.message : 'Could not verify an AI model.',
            );
            return;
          }
          if (generation !== cancelGenerationRef.current) return;
          openSession();
          try {
            await startOp('remediate', {
              ansible_version: ansibleVersion || undefined,
              collection_specs: colls.length ? colls : undefined,
              enable_ai: enableAi,
              ai_model: aiModel,
              interactive: !autoApplyTier1,
              abandon_working_set: true,
            });
            refreshOp();
          } catch (startErr) {
            console.error('Failed to restart remediation:', startErr);
            window.alert(
              startErr instanceof Error ? startErr.message : 'Failed to restart remediation.',
            );
          }
        }
        return;
      }
      throw err;
    }
  }, [
    ansibleVersion,
    autoApplyTier1,
    beginRemediateOp,
    buildColls,
    enableAi,
    api,
    getAiModel,
    openSession,
    refreshOp,
    startOp,
  ]);

  const escalateAi = useCallback(
    async (targets: AiEscalateTarget[]) => {
      openSession();
      await escalateAiOp(targets);
      refreshOp();
    },
    [escalateAiOp, openSession, refreshOp],
  );

  const dismiss = useCallback(() => {
    invalidatePendingCancel();
    trackedOpIdRef.current = null;
    setAttachOp(false);
    clearOp();
    onDismissSession?.();
  }, [clearOp, invalidatePendingCancel, onDismissSession]);

  useEffect(() => {
    if (attachOp && opState?.operation_id) {
      trackedOpIdRef.current = opState.operation_id;
    }
  }, [attachOp, opState?.operation_id]);

  // Server-side cancel — detach without blank panel; ignore stale cancelled snapshots.
  useEffect(() => {
    if (
      attachOp &&
      opState?.status === 'cancelled' &&
      !isCancelling &&
      opState.operation_id === trackedOpIdRef.current
    ) {
      dismiss();
    }
  }, [
    attachOp,
    opState?.status,
    opState?.operation_id,
    isCancelling,
    dismiss,
  ]);

  const resumeSession = useCallback(() => {
    openSession();
  }, [openSession]);

  const startOver = useCallback(async () => {
    const ok = window.confirm(
      'Discard the current interactive session and start a new scan?',
    );
    if (!ok) return;

    const generation = cancelGenerationRef.current;
    const colls = buildColls();
    let aiModel: string | undefined;
    try {
      aiModel = enableAi ? await resolveAiModel(api, getAiModel) : undefined;
    } catch (err) {
      if (generation !== cancelGenerationRef.current) return;
      console.error('Could not resolve AI model:', err);
      window.alert(err instanceof Error ? err.message : 'Could not verify an AI model.');
      return;
    }
    if (generation !== cancelGenerationRef.current) return;
    invalidatePendingCancel();
    clearOp();
    setAttachOp(true);
    onOpenSession?.();
    try {
      await startOp('check', {
        ansible_version: ansibleVersion || undefined,
        collection_specs: colls.length ? colls : undefined,
        enable_ai: enableAi,
        ai_model: aiModel,
        assess_pause: true,
        interactive: true,
        abandon_working_set: true,
      });
      refreshOp();
    } catch (err) {
      console.error('Failed to start over:', err);
      window.alert(
        err instanceof Error ? err.message : 'Could not start over. Try Scan again from Options.',
      );
    }
  }, [
    ansibleVersion,
    buildColls,
    clearOp,
    enableAi,
    api,
    getAiModel,
    invalidatePendingCancel,
    onOpenSession,
    refreshOp,
    startOp,
  ]);

  const findResumableScanId = useCallback(
    async (latestScanId: string | undefined): Promise<string | null> => {
      if (!projectId || !latestScanId) return null;
      if (attachOp && opState && LIVE_OPERATION_STATUSES.has(opState.status)) {
        return opState.scan_id === latestScanId ? latestScanId : null;
      }
      try {
        const op = await fetchProjectOperationState(projectId, api);
        if (
          op &&
          op.scan_id === latestScanId &&
          LIVE_OPERATION_STATUSES.has(op.status)
        ) {
          return latestScanId;
        }
      } catch {
        /* probe failed — cannot confirm resumable */
      }
      return null;
    },
    [attachOp, opState, projectId, api],
  );

  const cancel = useCallback(async () => {
    if (isCancelling) return;
    cancelGenerationRef.current += 1;
    const generation = cancelGenerationRef.current;
    setIsCancelling(true);
    try {
      await cancelOp();
      if (generation !== cancelGenerationRef.current) return;
      dismiss();
    } catch (err) {
      if (generation !== cancelGenerationRef.current) return;
      console.error('Failed to cancel operation:', err);
      setIsCancelling(false);
      window.alert(
        err instanceof Error ? err.message : 'Failed to cancel operation.',
      );
    }
  }, [cancelOp, dismiss, isCancelling]);

  return {
    attachOp,
    setAttachOp,
    opState,
    isRunning,
    isCancelling,
    operationActive,
    sessionTabVisible,
    refreshOp,
    clearOp,
    startScan,
    beginRemediate,
    escalateAi,
    approve: approveWithState,
    cancel,
    createPR,
    patchProposals,
    dismiss,
    resumeSession,
    startOver,
    findResumableScanId,
  };
}
