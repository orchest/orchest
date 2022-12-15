import { dirname, isDirectory } from "@/utils/path";
import create from "zustand";

export type FileManagerState = {
  projectUuid: string | undefined;
  selected: string[];
  expanded: string[];
  init: (projectUuid: string) => void;
  selectExclusive: (path: string) => void;
  setSelected: (paths: string[] | ((current: string[]) => string[])) => void;
  setExpanded: (paths: string[] | ((current: string[]) => string[])) => void;
};

const DEFAULT_CWD = "/project-dir:/";

export const useFileManagerState = create<FileManagerState>((set, get) => {
  const setSelected: FileManagerState["setSelected"] = (paths) =>
    set((current) => ({
      selected: paths instanceof Function ? paths(current.selected) : paths,
    }));

  const setExpanded: FileManagerState["setExpanded"] = (paths) => {
    set((current) => ({
      expanded: paths instanceof Function ? paths(current.expanded) : paths,
    }));
  };

  return {
    selected: [],
    expanded: [],
    projectUuid: undefined,
    setSelected,
    setExpanded,
    selectExclusive: (path: string) => {
      const directory = isDirectory(path) ? path : dirname(path);

      setExpanded((expanded) =>
        !expanded.includes(directory) ? [...expanded, directory] : expanded
      );
      setSelected((selected) => (selected.length > 1 ? selected : [path]));
    },
    init: (projectUuid: string) => {
      if (!projectUuid) return;
      if (get().projectUuid === projectUuid) return;

      set({ projectUuid, expanded: [DEFAULT_CWD], selected: [] });
    },
  };
});
