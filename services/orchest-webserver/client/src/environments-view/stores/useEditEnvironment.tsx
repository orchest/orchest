import { EnvironmentState } from "@/types";
import create from "zustand";

type EditEnvironmentState = {
  /** The assumed built environment state. */
  built?: EnvironmentState;
  /** The changes to the environment state. */
  environmentChanges?: EnvironmentState;
  /** Initialize the store. */
  initEnvironmentChanges: (state: EnvironmentState | undefined) => void;
  /** Apply a partial update of the changes. */
  setEnvironmentChanges: (
    changes:
      | Partial<EnvironmentState>
      | ((state: EnvironmentState) => Partial<EnvironmentState>)
  ) => void;
  /** Sets the `built` state to the changes. */
  setBuilt: () => void;
};

export const useEditEnvironment = create<EditEnvironmentState>((set) => ({
  initEnvironmentChanges: (initial) =>
    set((current) => ({
      environmentChanges: initial,
      built: current.built ?? initial,
    })),
  setEnvironmentChanges: (changes) =>
    set((state) => {
      if (!state.environmentChanges) return state;

      const patch =
        changes instanceof Function
          ? changes(state.environmentChanges)
          : changes;

      return {
        environmentChanges: { ...state.environmentChanges, ...patch },
      };
    }),
  setBuilt: () => set((state) => ({ built: state.environmentChanges })),
}));
