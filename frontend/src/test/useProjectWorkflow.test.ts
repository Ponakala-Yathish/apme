import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApmeApiAdapter } from '../../packages/ui-workflow/src/api/apmeApiAdapter';

const workflowMocks = vi.hoisted(() => {
  class MockSessionExpiredError extends Error {}
  class MockWorkingSetConflictError extends Error {}
  return {
    start: vi.fn(),
    beginRemediate: vi.fn(),
    refresh: vi.fn(),
    clear: vi.fn(),
    SessionExpiredError: MockSessionExpiredError,
    WorkingSetConflictError: MockWorkingSetConflictError,
  };
});

vi.mock('../../packages/ui-workflow/src/api/listAiModels', () => ({
  listAiModels: vi.fn(),
}));
vi.mock('../../packages/ui-workflow/src/hooks/useProjectOperationState', () => ({
  fetchProjectOperationState: vi.fn(),
  LIVE_OPERATION_STATUSES: new Set(),
  useProjectOperationState: () => ({
    state: null,
    refresh: workflowMocks.refresh,
    clear: workflowMocks.clear,
    applyLocalApprovalAck: vi.fn(),
  }),
}));
vi.mock('../../packages/ui-workflow/src/hooks/useProjectOperationActions', () => ({
  SessionExpiredError: workflowMocks.SessionExpiredError,
  WorkingSetConflictError: workflowMocks.WorkingSetConflictError,
  useProjectOperationActions: () => ({
    start: workflowMocks.start,
    approve: vi.fn(),
    beginRemediate: workflowMocks.beginRemediate,
    cancel: vi.fn(),
    createPR: vi.fn(),
    patchProposals: vi.fn(),
    escalateAi: vi.fn(),
  }),
}));

import {
  listAiModels,
  type AiModelInfo,
} from '../../packages/ui-workflow/src/api/listAiModels';
import { SessionExpiredError } from '../../packages/ui-workflow/src/hooks/useProjectOperationActions';
import {
  resolveAiModel,
  useProjectWorkflow,
  type UseProjectWorkflowOptions,
} from '../../packages/ui-workflow/src/useProjectWorkflow';

const api = {} as ApmeApiAdapter;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  workflowMocks.start.mockReset().mockResolvedValue(undefined);
  workflowMocks.beginRemediate.mockReset().mockResolvedValue(undefined);
  workflowMocks.refresh.mockReset();
  workflowMocks.clear.mockReset();
  vi.mocked(listAiModels).mockReset();
});

function renderWorkflow(
  options: Pick<UseProjectWorkflowOptions, 'onOpenSession' | 'onDismissSession'> = {},
) {
  return renderHook(() =>
    useProjectWorkflow('proj-1', {
      checkOptions: {
        ansibleVersion: '',
        collections: '',
        enableAi: true,
        autoApplyTier1: false,
      },
      ...options,
    }),
  );
}

function deferModelCatalog() {
  let resolve!: (models: AiModelInfo[]) => void;
  const promise = new Promise<AiModelInfo[]>((resolvePromise) => {
    resolve = resolvePromise;
  });
  vi.mocked(listAiModels).mockReturnValue(promise);
  return { resolve };
}

describe('resolveAiModel', () => {
  it('keeps a selected model when it appears in the current catalog', async () => {
    vi.mocked(listAiModels).mockResolvedValue([
      { id: 'model-a', provider: 'provider', name: 'Model A' },
      { id: 'model-b', provider: 'provider', name: 'Model B' },
    ]);

    await expect(resolveAiModel(api, () => 'model-b')).resolves.toBe('model-b');
  });

  it('passes the selected browser-storage model to the operation request', async () => {
    localStorage.setItem('apme-ai-model', 'model-b');
    vi.mocked(listAiModels).mockResolvedValue([
      { id: 'model-a', provider: 'provider', name: 'Model A' },
      { id: 'model-b', provider: 'provider', name: 'Model B' },
    ]);
    const { result } = renderWorkflow();

    await act(async () => result.current.startScan());

    expect(workflowMocks.start).toHaveBeenCalledWith(
      'check',
      expect.objectContaining({ ai_model: 'model-b' }),
    );
  });

  it('replaces a stored model that is missing from the current catalog', async () => {
    localStorage.setItem('apme-ai-model', 'removed-model');
    vi.mocked(listAiModels).mockResolvedValue([
      { id: 'current-model', provider: 'provider', name: 'Current Model' },
    ]);

    await expect(resolveAiModel(api)).resolves.toBe('current-model');
  });

  it('uses the catalog default when browser storage access throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('Storage is blocked', 'SecurityError');
      },
    });
    vi.mocked(listAiModels).mockResolvedValue([
      { id: 'current-model', provider: 'provider', name: 'Current Model' },
    ]);

    await expect(resolveAiModel(api)).resolves.toBe('current-model');
  });

  it('does not submit a stored model when the catalog cannot validate it', async () => {
    localStorage.setItem('apme-ai-model', 'possibly-stale-model');
    vi.mocked(listAiModels).mockRejectedValue(new Error('catalog unavailable'));

    await expect(resolveAiModel(api)).rejects.toThrow(/Could not verify an AI model/);
  });

  it('rejects an empty catalog instead of returning an unverified model', async () => {
    vi.mocked(listAiModels).mockResolvedValue([]);

    await expect(resolveAiModel(api)).rejects.toThrow(/No AI model is available/);
  });

  it('reports catalog errors and does not start a scan', async () => {
    vi.mocked(listAiModels).mockResolvedValue([]);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result } = renderWorkflow();

    await act(async () => result.current.startScan());

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/No AI model is available/));
  });

  it('reports catalog errors and does not start over', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(listAiModels).mockRejectedValue(new Error('catalog unavailable'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result } = renderWorkflow();

    await act(async () => result.current.startOver());

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/Could not verify an AI model/));
  });

  it('reports catalog errors and does not restart an expired session', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    workflowMocks.beginRemediate.mockRejectedValue(new SessionExpiredError('expired'));
    vi.mocked(listAiModels).mockResolvedValue([]);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result } = renderWorkflow();

    await act(async () => result.current.beginRemediate());

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/No AI model is available/));
  });

  it('does not reopen a dismissed session when scan model lookup finishes', async () => {
    const catalog = deferModelCatalog();
    const onOpenSession = vi.fn();
    const onDismissSession = vi.fn();
    const { result } = renderWorkflow({ onOpenSession, onDismissSession });
    let startPromise!: Promise<void>;

    await act(async () => {
      startPromise = result.current.startScan();
      await Promise.resolve();
    });
    expect(listAiModels).toHaveBeenCalledOnce();
    act(() => result.current.dismiss());
    catalog.resolve([{ id: 'model-a', provider: 'provider', name: 'Model A' }]);
    await act(async () => startPromise);

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(onOpenSession).not.toHaveBeenCalled();
    expect(onDismissSession).toHaveBeenCalledOnce();
  });

  it('does not restart expired-session remediation after dismissal during model lookup', async () => {
    const catalog = deferModelCatalog();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onOpenSession = vi.fn();
    const onDismissSession = vi.fn();
    workflowMocks.beginRemediate.mockRejectedValueOnce(new SessionExpiredError('expired'));
    const { result } = renderWorkflow({ onOpenSession, onDismissSession });
    let remediatePromise!: Promise<void>;

    await act(async () => {
      remediatePromise = result.current.beginRemediate();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(listAiModels).toHaveBeenCalledOnce();
    act(() => result.current.dismiss());
    catalog.resolve([{ id: 'model-a', provider: 'provider', name: 'Model A' }]);
    await act(async () => remediatePromise);

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(onOpenSession).toHaveBeenCalledOnce();
    expect(onDismissSession).toHaveBeenCalledOnce();
  });

  it('does not start over after dismissal during model lookup', async () => {
    const catalog = deferModelCatalog();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onOpenSession = vi.fn();
    const onDismissSession = vi.fn();
    const { result } = renderWorkflow({ onOpenSession, onDismissSession });
    let startOverPromise!: Promise<void>;

    await act(async () => {
      startOverPromise = result.current.startOver();
      await Promise.resolve();
    });
    expect(listAiModels).toHaveBeenCalledOnce();
    act(() => result.current.dismiss());
    catalog.resolve([{ id: 'model-a', provider: 'provider', name: 'Model A' }]);
    await act(async () => startOverPromise);

    expect(workflowMocks.start).not.toHaveBeenCalled();
    expect(onOpenSession).not.toHaveBeenCalled();
    expect(onDismissSession).toHaveBeenCalledOnce();
  });
});
