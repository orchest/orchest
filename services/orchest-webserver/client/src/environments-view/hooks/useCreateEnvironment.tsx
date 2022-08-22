import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getNewEnvironmentName } from "../common";

export const useCreateEnvironment = () => {
  const { config } = useGlobalContext();

  const { environments, post, isPosting } = useEnvironmentsApi();

  const defaultEnvironment = config?.ENVIRONMENT_DEFAULTS;
  const newEnvironmentName = getNewEnvironmentName(
    defaultEnvironment?.name || "New environment",
    environments
  );
  const isAllowedToCreate =
    hasValue(newEnvironmentName) && hasValue(defaultEnvironment);

  const createEnvironment = React.useCallback(() => {
    if (!isPosting && isAllowedToCreate) {
      return post(newEnvironmentName, defaultEnvironment);
    }
  }, [
    post,
    isPosting,
    defaultEnvironment,
    isAllowedToCreate,
    newEnvironmentName,
  ]);

  return { createEnvironment, isCreating: isPosting, isAllowedToCreate };
};
