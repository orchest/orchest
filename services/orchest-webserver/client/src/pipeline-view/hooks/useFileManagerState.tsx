import create from "zustand";

export type FileManagerState = {
  projectUuid: string | undefined;
  selected: string[];
  expanded: string[];
  init: (projectUuid: string) => void;
  setSelected: (paths: string[] | ((current: string[]) => string[])) => void;
  setExpanded: (paths: string[] | ((current: string[]) => string[])) => void;
};

const DEFAULT_CWD = "/project-dir:/";

export const useFileManagerState = create<FileManagerState>((set, get) => {
  return {
    selected: [],
    expanded: [],
    projectUuid: undefined,
    init: (projectUuid: string) => {
      if (!projectUuid) return;
      if (get().projectUuid === projectUuid) return;

      set({ projectUuid, expanded: [DEFAULT_CWD], selected: [] });
    },
    setSelected: (paths) => {
      set((current) => ({
        selected: paths instanceof Function ? paths(current.selected) : paths,
      }));
    },
    setExpanded: (paths) => {
      set((current) => ({
        expanded: paths instanceof Function ? paths(current.expanded) : paths,
      }));
    },
  };
});
