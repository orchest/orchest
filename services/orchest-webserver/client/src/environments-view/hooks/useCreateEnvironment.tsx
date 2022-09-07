import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { EnvironmentData } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getNewEnvironmentName } from "../common";

export const useCreateEnvironment = () => {
  const { config } = useGlobalContext();
  const { run, status } = useAsync<EnvironmentData | undefined>();

  const environments = useEnvironmentsApi((state) => state.environments);
  const post = useEnvironmentsApi((state) => state.post);

  const defaultEnvironment = config?.ENVIRONMENT_DEFAULTS;
  const newEnvironmentName = getNewEnvironmentName(
    defaultEnvironment?.name || "New environment",
    environments
  );
  const isAllowedToCreate =
    hasValue(newEnvironmentName) && hasValue(defaultEnvironment);

  const createEnvironment = React.useCallback(() => {
    if (status !== "PENDING" && isAllowedToCreate) {
      return run(post(newEnvironmentName, defaultEnvironment));
    }
  }, [
    post,
    run,
    status,
    defaultEnvironment,
    isAllowedToCreate,
    newEnvironmentName,
  ]);

  return {
    createEnvironment,
    isCreating: status === "PENDING",
    isAllowedToCreate,
  };
};
