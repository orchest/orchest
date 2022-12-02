import create from "zustand";

export type SelectedFilesState = {
  selected: string[];
  setSelected: (paths: string[] | ((current: string[]) => string[])) => void;
};

export const useSelectedFiles = create<SelectedFilesState>((set) => {
  return {
    selected: [],
    setSelected: (paths) => {
      set((current) => ({
        selected: paths instanceof Function ? paths(current.selected) : paths,
      }));
    },
  };
});
