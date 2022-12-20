import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { EnvironmentData, EnvironmentSpec, Language } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { DEFAULT_BASE_IMAGES, getNewEnvironmentName } from "../common";

export const useCreateEnvironment = () => {
  const config = useOrchestConfigsApi((state) => state.config);

  const { run, status } = useAsync<EnvironmentData | undefined>();

  const environments = useEnvironmentsApi((state) => state.environments);
  const post = useEnvironmentsApi((state) => state.post);

  const defaultEnvironment = config?.ENVIRONMENT_DEFAULTS;
  const newEnvironmentName = getNewEnvironmentName(
    defaultEnvironment?.name || "New environment",
    environments
  );
  const canCreateEnvironment =
    hasValue(newEnvironmentName) && hasValue(defaultEnvironment);

  const createEnvironment = React.useCallback(
    async (language?: Language, customEnvironmentName?: string) => {
      const baseImage = language
        ? DEFAULT_BASE_IMAGES.find((image) => image.language === language)
            ?.base_image
        : defaultEnvironment?.base_image;
      const environmentSpec = {
        ...defaultEnvironment,
        name: "New Environment",
        base_image: baseImage,
        language: language || defaultEnvironment?.language,
      } as EnvironmentSpec;
      if (status !== "PENDING" && canCreateEnvironment) {
        return run(
          post(customEnvironmentName ?? newEnvironmentName, environmentSpec)
        );
      }
    },
    [
      defaultEnvironment,
      status,
      canCreateEnvironment,
      run,
      post,
      newEnvironmentName,
    ]
  );

  return {
    createEnvironment,
    isCreating: status === "PENDING",
    canCreateEnvironment,
  };
};
