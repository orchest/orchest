import { JobChanges } from "@/types";
import create from "zustand";

export const useEditJob = create<{
  jobChanges?: JobChanges;
  initJobChanges: (payload: JobChanges | undefined) => void;
  setJobChanges: (
    payload: Partial<JobChanges> | ((state: JobChanges) => Partial<JobChanges>)
  ) => void;
}>((set) => ({
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
}));
