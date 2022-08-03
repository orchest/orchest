import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { EnvironmentState } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import create from "zustand";

export const isCompleteEnvironmentState = (
  value: Partial<EnvironmentState>
): value is EnvironmentState => hasValue(value.uuid);

export const useEnvironmentOnEdit = create<{
  environmentOnEdit: EnvironmentState | Partial<EnvironmentState>;
  setEnvironmentOnEdit: (
    payload: EnvironmentState | Partial<EnvironmentState>
  ) => void;
}>((set) => ({
  environmentOnEdit: {},
  setEnvironmentOnEdit: (payload) =>
    set((state) => ({
      environmentOnEdit: state.environmentOnEdit
        ? { ...state.environmentOnEdit, ...payload }
        : payload,
    })),
}));

const selector = (state: EnvironmentsApiState) =>
  [state.environments, state.put, state.isPutting] as const;

export const useLoadEnvironmentOnEdit = () => {
  const { environmentUuid } = useCustomRoute();

  const [environments, put, isUpdating] = useEnvironmentsApi(selector);

  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  React.useEffect(() => {
    const found = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    setEnvironmentOnEdit(found || environments?.[0] || {});
  }, [environments, environmentUuid, setEnvironmentOnEdit]);

  const environmentState = useDebounce(environmentOnEdit, 250);

  React.useEffect(() => {
    if (isCompleteEnvironmentState(environmentState)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { action, ...environmentData } = environmentState;
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      put(environmentData.uuid, environmentData);
    }
  }, [put, environmentState]);

  return { environmentOnEdit, isUpdating };
};
