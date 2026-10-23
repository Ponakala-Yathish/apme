import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApmeApiAdapter } from '../../packages/ui-workflow/src/api/apmeApiAdapter';

vi.mock('../../packages/ui-workflow/src/api/listAiModels', () => ({
  listAiModels: vi.fn(),
}));

import { listAiModels } from '../../packages/ui-workflow/src/api/listAiModels';
import { resolveAiModel } from '../../packages/ui-workflow/src/useProjectWorkflow';

const api = {} as ApmeApiAdapter;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('resolveAiModel', () => {
  it('keeps a selected model when it appears in the current catalog', async () => {
    vi.mocked(listAiModels).mockResolvedValue([
      { id: 'model-a', provider: 'provider', name: 'Model A' },
      { id: 'model-b', provider: 'provider', name: 'Model B' },
    ]);

    await expect(resolveAiModel(api, () => 'model-b')).resolves.toBe('model-b');
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

    await expect(resolveAiModel(api)).resolves.toBeUndefined();
  });
});
