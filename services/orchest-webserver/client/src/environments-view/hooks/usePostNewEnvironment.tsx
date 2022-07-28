import { useAppContext } from "@/contexts/AppContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { Environment } from "@/types";
import { HEADER } from "@orchest/lib-utils";
import React from "react";

export const usePostNewEnvironment = () => {
  const { cancelableFetch } = useCancelableFetch();
  const [isPostingEnvironment, setIsPostingEnvironment] = React.useState(false);

  const { config } = useAppContext();
  const defaultEnvironments = config?.ENVIRONMENT_DEFAULTS;

  const postEnvironment = React.useCallback(
    async (projectUuid: string, environmentName: string) => {
      try {
        setIsPostingEnvironment(true);
        const newEnvironment = await cancelableFetch<Environment>(
          `/store/environments/${projectUuid}/new`,
          {
            method: "POST",
            headers: HEADER.JSON,
            body: JSON.stringify({
              environment: {
                ...defaultEnvironments,
                uuid: "new",
                name: environmentName,
              },
            }),
          }
        );
        setIsPostingEnvironment(false);
        return newEnvironment;
      } catch (error) {
        if (!error.isCanceled) throw error;
      }
    },
    [cancelableFetch, defaultEnvironments]
  );

  return { postEnvironment, isPostingEnvironment };
};
