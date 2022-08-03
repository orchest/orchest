import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import { Environment, EnvironmentState } from "@/types";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import create from "zustand";

export const isCompleteEnvironmentState = (
  value: Partial<EnvironmentState>
): value is EnvironmentState => hasValue(value.uuid);

export const useEnvironmentOnEdit = create<{
  environmentOnEdit: EnvironmentState | Partial<EnvironmentState>;
  setEnvironmentOnEdit: (
    payload: EnvironmentState | Partial<EnvironmentState>,
    init?: boolean
  ) => void;
}>((set) => ({
  environmentOnEdit: {},
  setEnvironmentOnEdit: (payload, init = false) => {
    const payloadWithHash = init ? payload : { ...payload, hash: uuidv4() };
    set((state) => ({
      environmentOnEdit: state.environmentOnEdit
        ? { ...state.environmentOnEdit, ...payloadWithHash }
        : payloadWithHash,
    }));
  },
}));

const selector = (state: EnvironmentsApiState) =>
  [state.environments, state.put, state.isPutting] as const;

const getPutEnvironmentPayload = (
  environmentState: EnvironmentState
): Environment => {
  const {
    action, // eslint-disable-line @typescript-eslint/no-unused-vars
    hash, // eslint-disable-line @typescript-eslint/no-unused-vars
    latestBuild: latestBuildStatus, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...environmentData
  } = environmentState;

  return environmentData;
};

/**
 * Load the environmentOnEdit to the store based on the query arg environment_uuid.
 * Watch the changes of environmentOnEdit and save it to BE accordingly. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveEnvironmentOnEdit = () => {
  const { environmentUuid } = useCustomRoute();

  const [environments, put, isUpdating] = useEnvironmentsApi(selector);

  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  React.useEffect(() => {
    const found = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    setEnvironmentOnEdit(found || environments?.[0] || {}, true);
  }, [environments, environmentUuid, setEnvironmentOnEdit]);

  const environmentState = useDebounce(environmentOnEdit, 250);

  const shouldSave = useHasChanged(
    environmentState,
    (prev, curr) => Boolean(prev?.hash) && prev?.hash !== curr.hash
  );

  React.useEffect(() => {
    if (shouldSave && isCompleteEnvironmentState(environmentState)) {
      const environmentData = getPutEnvironmentPayload(environmentState);
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      put(environmentData.uuid, environmentData);
    }
  }, [shouldSave, put, environmentState]);

  return { environmentOnEdit, isUpdating };
};
