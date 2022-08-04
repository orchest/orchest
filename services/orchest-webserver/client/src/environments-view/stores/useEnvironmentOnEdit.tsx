import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useHasChanged } from "@/hooks/useHasChanged";
import { EnvironmentState } from "@/types";
import React from "react";
import create from "zustand";

const useEnvironmentOnEditStore = create<{
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

/**
 * Manages the state of Environment on Edit, and serves as the source of truth for updating an Environment.
 * Gets updated if latestBuild.status changes.
 */
export const useEnvironmentOnEdit = () => {
  const {
    environmentOnEdit,
    setEnvironmentOnEdit,
    initEnvironmentOnEdit,
  } = useEnvironmentOnEditStore();
  const { environments } = useEnvironmentsApi();
  const environmentOnEditFromStore = environments?.find(
    (env) => env.uuid === environmentOnEdit?.uuid
  );

  const hasLatestBuildStatusChanged = useHasChanged(
    environmentOnEditFromStore,
    (prev, curr) => {
      if (!prev || !curr) return false;
      return prev.latestBuild?.status !== curr.latestBuild?.status;
    }
  );

  React.useEffect(() => {
    if (hasLatestBuildStatusChanged) {
      setEnvironmentOnEdit({
        latestBuild: environmentOnEditFromStore?.latestBuild,
      });
    }
  }, [
    setEnvironmentOnEdit,
    hasLatestBuildStatusChanged,
    environmentOnEditFromStore,
  ]);

  return { environmentOnEdit, setEnvironmentOnEdit, initEnvironmentOnEdit };
};
