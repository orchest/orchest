import { EnvironmentState } from "@/types";
import create from "zustand";

export const useEnvironmentOnEdit = create<{
  environmentOnEdit?: EnvironmentState;
  initEnvironmentOnEdit: (payload: EnvironmentState | undefined) => void;
  setEnvironmentOnEdit: (
    payload:
      | Partial<EnvironmentState>
      | ((state: EnvironmentState) => Partial<EnvironmentState>)
  ) => void;
}>((set) => ({
  initEnvironmentOnEdit: (value) => {
    set({ environmentOnEdit: value });
  },
  setEnvironmentOnEdit: (value) => {
    set((state) => {
      if (!state.environmentOnEdit) return state;
      const updatedPayload =
        value instanceof Function ? value(state.environmentOnEdit) : value;
      return {
        environmentOnEdit: { ...state.environmentOnEdit, ...updatedPayload },
      };
    });
  },
}));
