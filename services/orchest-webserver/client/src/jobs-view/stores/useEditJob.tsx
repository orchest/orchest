import { JobChanges } from "@/types";
import create from "zustand";

export type JobChangesState = {
  jobChanges?: JobChanges;
  initJobChanges: (payload: JobChanges | undefined) => void;
  setJobChanges: (
    payload: Partial<JobChanges> | ((state: JobChanges) => Partial<JobChanges>)
  ) => void;
  resetJobChanges: () => void;
};

export const useEditJob = create<JobChangesState>((set) => ({
  initJobChanges: (value) => {
    set({ jobChanges: value });
  },
  setJobChanges: (value) => {
    set((state) => {
      if (!state.jobChanges) return state;
      const changes =
        value instanceof Function ? value(state.jobChanges) : value;
      return {
        jobChanges: { ...state.jobChanges, ...changes },
      };
    });
  },
  resetJobChanges: () => set({ jobChanges: undefined }),
}));
