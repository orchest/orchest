import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Environment } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

const selector = (state: EnvironmentsApiState) =>
  [state.environments, state.put, state.isPutting] as const;

export const useEditEnvironment = () => {
  const { environmentUuid } = useCustomRoute();

  const [environments, put, isUpdating] = useEnvironmentsApi(selector);

  const environment = React.useMemo(() => {
    const found = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    return found || environments?.[0];
  }, [environments, environmentUuid]);

  const isAllowedToUpdate = hasValue(environment);

  const updateEnvironment = React.useCallback(
    (payload: Partial<Environment>) => {
      if (!isUpdating && isAllowedToUpdate) {
        return put(environment.uuid, payload);
      }
    },
    [environment?.uuid, isAllowedToUpdate, isUpdating, put]
  );

  return { updateEnvironment, isUpdating, isAllowedToUpdate };
};
