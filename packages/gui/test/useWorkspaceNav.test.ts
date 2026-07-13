import { describe, expect, it } from 'vitest';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';

describe('useWorkspaceNav', () => {
  it('defaults to overview', () => {
    const { route, isOverview, currentSlug, currentPanel, openOverview } = useWorkspaceNav();
    openOverview();

    expect(route.value).toEqual({ name: 'overview' });
    expect(isOverview.value).toBe(true);
    expect(currentSlug.value).toBeNull();
    expect(currentPanel.value).toBeNull();
  });

  it('openTopic switches to topic with default map panel', () => {
    const { route, isOverview, currentSlug, currentPanel, openTopic } = useWorkspaceNav();

    openTopic('rust');

    expect(route.value).toEqual({ name: 'topic', slug: 'rust', panel: { kind: 'map' } });
    expect(isOverview.value).toBe(false);
    expect(currentSlug.value).toBe('rust');
    expect(currentPanel.value).toEqual({ kind: 'map' });
  });

  it('openOverview resets back from topic to overview', () => {
    const { route, isOverview, currentSlug, currentPanel, openTopic, openOverview } =
      useWorkspaceNav();

    openTopic('react', { kind: 'note', fileId: 'hooks.md' });
    openOverview();

    expect(route.value).toEqual({ name: 'overview' });
    expect(isOverview.value).toBe(true);
    expect(currentSlug.value).toBeNull();
    expect(currentPanel.value).toBeNull();
  });

  it('openTopic with explicit note panel', () => {
    const { currentSlug, currentPanel, openTopic } = useWorkspaceNav();

    openTopic('react', { kind: 'note', fileId: 'hooks.md' });

    expect(currentSlug.value).toBe('react');
    expect(currentPanel.value).toEqual({ kind: 'note', fileId: 'hooks.md' });
  });

  it('openTopic with explicit code panel', () => {
    const { currentSlug, currentPanel, openTopic } = useWorkspaceNav();

    openTopic('rust', { kind: 'code', fileId: 'lifetime-1.rs' });

    expect(currentSlug.value).toBe('rust');
    expect(currentPanel.value).toEqual({ kind: 'code', fileId: 'lifetime-1.rs' });
  });

  it('openPanel switches panel within the same topic', () => {
    const { route, currentPanel, openTopic, openPanel } = useWorkspaceNav();

    openTopic('postgresql', { kind: 'map' });
    openPanel({ kind: 'note', fileId: 'indexes.md' });

    expect(route.value).toEqual({
      name: 'topic',
      slug: 'postgresql',
      panel: { kind: 'note', fileId: 'indexes.md' },
    });
    expect(currentPanel.value).toEqual({ kind: 'note', fileId: 'indexes.md' });
  });

  it('openPanel from overview is a no-op', () => {
    const { route, openOverview, openPanel } = useWorkspaceNav();

    openOverview();
    openPanel({ kind: 'map' });

    expect(route.value).toEqual({ name: 'overview' });
  });

  it('is a singleton — the same object is returned across calls', () => {
    const a = useWorkspaceNav();
    const b = useWorkspaceNav();

    expect(a).toBe(b);
    a.openTopic('distributed-systems', { kind: 'map' });
    expect(b.currentSlug.value).toBe('distributed-systems');

    b.openOverview();
    expect(a.isOverview.value).toBe(true);
  });
});
