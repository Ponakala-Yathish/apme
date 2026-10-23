import { act, cleanup, renderHook } from '@testing-library/react';
import { usePageNotifications } from '@ansible/ansible-ui-framework';
import type { IPageNotification } from '@ansible/ansible-ui-framework/PageNotifications/PageNotification';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApmeApiProvider } from '../api/apmeApiAdapter';
import { listNotifications, markNotificationRead } from '../services/api';
import { useNotificationStream } from '../shell/useNotificationStream';
import type { NotificationItem, PaginatedResponse } from '../types/api';

vi.mock('../services/api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

class MockEventSource {
  static latest: MockEventSource | null = null;

  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  onerror: ((event: Event) => void) | null = null;

  readonly close = vi.fn();

  constructor(readonly url: string) {
    MockEventSource.latest = this;
  }

  emit(item: NotificationItem): void {
    this.onmessage?.({ data: JSON.stringify(item) } as MessageEvent<string>);
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <ApmeApiProvider>{children}</ApmeApiProvider>;
}

function notification(
  id: number,
  message: string,
  link = '',
): NotificationItem {
  return {
    id,
    type: 'scan_complete',
    title: 'Scan complete',
    message,
    variant: 'info',
    project_id: 'project-1',
    scan_id: 'scan-1',
    link,
    created_at: '2026-10-23T17:00:00Z',
    read: false,
  };
}

function response(items: NotificationItem[]): PaginatedResponse<NotificationItem> {
  return { items, total: items.length, limit: 100, offset: 0 };
}

function drawerItems(): IPageNotification[] {
  return usePageNotifications.getState().notificationGroups.Scans?.notifications ?? [];
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useNotificationStream same-ID updates', () => {
  beforeEach(() => {
    MockEventSource.latest = null;
    usePageNotifications.setState({ notificationGroups: {} });
    vi.stubGlobal('EventSource', MockEventSource);
    vi.mocked(listNotifications).mockResolvedValue(response([]));
    vi.mocked(markNotificationRead).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    usePageNotifications.setState({ notificationGroups: {} });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('replaces an existing SSE item and prepends new IDs', async () => {
    const { unmount } = renderHook(() => useNotificationStream(), { wrapper });
    await flushEffects();

    const eventSource = MockEventSource.latest;
    expect(eventSource).not.toBeNull();
    await act(async () => {
      eventSource?.emit(notification(1, '/proj: stale'));
      eventSource?.emit(notification(2, 'second'));
      eventSource?.emit(notification(1, 'attributed update', '/projects/project-1'));
      eventSource?.emit(notification(3, 'newest'));
    });

    expect(drawerItems().map(({ id }) => id)).toEqual(['3', '2', '1']);
    expect(drawerItems()[2]).toMatchObject({
      id: '1',
      description: 'attributed update',
      to: '/projects/project-1',
    });
    unmount();
  });

  it('lets the existing store replace a duplicate from the REST response', async () => {
    const current = notification(1, 'latest from the existing store', '/projects/project-1');
    usePageNotifications.setState({
      notificationGroups: {
        Scans: {
          title: 'Scans',
          notifications: [
            {
              id: String(current.id),
              title: current.title,
              description: current.message,
              timestamp: current.created_at,
              variant: current.variant,
              to: current.link,
            },
          ],
        },
      },
    });

    let resolveRest!: (value: PaginatedResponse<NotificationItem>) => void;
    const restResponse = new Promise<PaginatedResponse<NotificationItem>>((resolve) => {
      resolveRest = resolve;
    });
    vi.mocked(listNotifications).mockReturnValue(restResponse);

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper });
    await act(async () => {
      resolveRest(response([notification(1, '/proj: stale')]));
      await restResponse;
    });

    expect(drawerItems()).toHaveLength(1);
    expect(drawerItems()[0]).toMatchObject({
      id: '1',
      description: 'latest from the existing store',
      to: '/projects/project-1',
    });
    unmount();
  });

  it('applies buffered SSE updates over a REST item with the same ID', async () => {
    let resolveRest!: (value: PaginatedResponse<NotificationItem>) => void;
    const restResponse = new Promise<PaginatedResponse<NotificationItem>>((resolve) => {
      resolveRest = resolve;
    });
    vi.mocked(listNotifications).mockReturnValue(restResponse);

    const { unmount } = renderHook(() => useNotificationStream(), { wrapper });
    const eventSource = MockEventSource.latest;
    expect(eventSource).not.toBeNull();
    await act(async () => {
      eventSource?.emit(notification(1, 'attributed update', '/projects/project-1'));
    });

    await act(async () => {
      resolveRest(response([notification(1, '/proj: stale')]));
      await restResponse;
    });

    expect(drawerItems()).toHaveLength(1);
    expect(drawerItems()[0]).toMatchObject({
      id: '1',
      description: 'attributed update',
      to: '/projects/project-1',
    });
    unmount();
  });
});
