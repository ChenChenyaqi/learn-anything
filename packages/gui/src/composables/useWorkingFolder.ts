import { ref } from 'vue';
import { type ProjectInfo, createProject, openProject, pickProjectDir } from '../lib/commands';

// Working-folder selection, validation, and scaffolding.
//
// Owns the `project` / `projectError` / `folderBusy` state and the two folder
// operations, pulled out of App.vue so the shell only orchestrates. `chooseFolder`
// returns the picked path (or `null` on cancel) and deliberately does NOT touch
// app config — the caller updates `last_working_folder` itself, keeping this
// composable free of the config/keychain concern.
export function useWorkingFolder() {
  const project = ref<ProjectInfo | null>(null);
  const projectError = ref('');
  const folderBusy = ref(false);

  /** Validate `dir`; on a fresh folder, scaffold `.learn/topics/`. */
  async function openFolder(dir: string) {
    projectError.value = '';
    try {
      const info = await openProject(dir);
      if (info.fresh) {
        await createProject(dir);
      }
      project.value = info;
    } catch (e) {
      project.value = null;
      projectError.value = String(e);
    }
  }

  /** Open the native picker, then validate + scaffold. Returns the picked
   *  path, or `null` if the user cancelled. */
  async function chooseFolder(): Promise<string | null> {
    folderBusy.value = true;
    projectError.value = '';
    try {
      const dir = await pickProjectDir();
      if (dir) {
        await openFolder(dir);
      }
      return dir;
    } catch (e) {
      projectError.value = String(e);
      return null;
    } finally {
      folderBusy.value = false;
    }
  }

  return { project, projectError, folderBusy, openFolder, chooseFolder };
}
