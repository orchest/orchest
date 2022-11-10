import { EnvironmentState } from "@/types";
import create from "zustand";

type EditEnvironmentState = {
  /** The assumed built environment state. */
  built?: EnvironmentState;
  /** The changes to the environment state. */
  changes?: EnvironmentState;
  /** Initialize the store. */
  init: (state: EnvironmentState | undefined) => void;
  /** Apply a partial update of the changes. */
  update: (
    changes:
      | Partial<EnvironmentState>
      | ((state: EnvironmentState) => Partial<EnvironmentState>)
  ) => void;
  /** Sets the `built` state to the changes. */
  applyChanges: () => void;
};

export const useEditEnvironment = create<EditEnvironmentState>((set) => ({
  init: (initial) =>
    set((current) => ({ changes: initial, built: current.built ?? initial })),
  update: (changes) =>
    set((state) => {
      if (!state.changes) return state;

      const patch =
        changes instanceof Function ? changes(state.changes) : changes;

      return {
        changes: { ...state.changes, ...patch },
      };
    }),
  applyChanges: () => set((state) => ({ built: state.changes })),
}));
