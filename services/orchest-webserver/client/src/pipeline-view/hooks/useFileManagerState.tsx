import create from "zustand";

export type FileManagerState = {
  selected: string[];
  setSelected: (paths: string[] | ((current: string[]) => string[])) => void;
};

export const useFileManagerState = create<FileManagerState>((set) => {
  return {
    selected: [],
    setSelected: (paths) => {
      set((current) => ({
        selected: paths instanceof Function ? paths(current.selected) : paths,
      }));
    },
  };
});
