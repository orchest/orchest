import { EnvironmentState } from "@/types";
import create from "zustand";

export const useEditEnvironment = create<{
  environmentChanges?: EnvironmentState;
  initEnvironmentChanges: (payload: EnvironmentState | undefined) => void;
  setEnvironmentChanges: (
    payload:
      | Partial<EnvironmentState>
      | ((state: EnvironmentState) => Partial<EnvironmentState>)
  ) => void;
}>((set) => ({
  initEnvironmentChanges: (value) => {
    set({ environmentChanges: value });
  },
  setEnvironmentChanges: (value) => {
    set((state) => {
      if (!state.environmentChanges) return state;
      const updatedPayload =
        value instanceof Function ? value(state.environmentChanges) : value;
      return {
        environmentChanges: { ...state.environmentChanges, ...updatedPayload },
      };
    });
  },
}));
