import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkingFolder } from '@/composables/useWorkingFolder';
import { createProject, openProject, pickProjectDir } from '@/lib/commands';
import type { ProjectInfo } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  openProject: vi.fn(),
  createProject: vi.fn(),
  pickProjectDir: vi.fn(),
}));

const mockOpen = vi.mocked(openProject);
const mockCreate = vi.mocked(createProject);
const mockPick = vi.mocked(pickProjectDir);

function info(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return { dir: '/proj', fresh: false, topics: [], ...overrides };
}

describe('useWorkingFolder', () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockCreate.mockReset();
    mockPick.mockReset();
  });

  describe('openFolder', () => {
    it('stores the project and skips scaffolding for an existing folder', async () => {
      mockOpen.mockResolvedValue(info({ topics: [{ slug: 'rust', topic: 'Rust' }] }));
      const { project, projectError, openFolder } = useWorkingFolder();

      await openFolder('/proj');

      expect(mockOpen).toHaveBeenCalledWith('/proj');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(project.value?.topics).toHaveLength(1);
      expect(projectError.value).toBe('');
    });

    it('scaffolds .learn/topics on a fresh folder', async () => {
      mockOpen.mockResolvedValue(info({ fresh: true }));
      const { openFolder } = useWorkingFolder();

      await openFolder('/proj');

      expect(mockCreate).toHaveBeenCalledWith('/proj');
    });

    it('clears the project and records the error on rejection', async () => {
      mockOpen.mockRejectedValue(new Error('bad version'));
      const { project, projectError, openFolder } = useWorkingFolder();

      await openFolder('/proj');

      expect(project.value).toBeNull();
      expect(projectError.value).toContain('bad version');
    });
  });

  describe('chooseFolder', () => {
    it('picks, opens, and returns the chosen path', async () => {
      mockPick.mockResolvedValue('/picked');
      mockOpen.mockResolvedValue(info());
      const { chooseFolder, folderBusy } = useWorkingFolder();

      const dir = await chooseFolder();

      expect(dir).toBe('/picked');
      expect(mockOpen).toHaveBeenCalledWith('/picked');
      expect(folderBusy.value).toBe(false);
    });

    it('returns null and does not open when the user cancels', async () => {
      mockPick.mockResolvedValue(null);
      const { chooseFolder } = useWorkingFolder();

      const dir = await chooseFolder();

      expect(dir).toBeNull();
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('records the error and returns null when picking throws', async () => {
      mockPick.mockRejectedValue(new Error('picker dropped'));
      const { chooseFolder, projectError } = useWorkingFolder();

      const dir = await chooseFolder();

      expect(dir).toBeNull();
      expect(projectError.value).toContain('picker dropped');
    });
  });
});
