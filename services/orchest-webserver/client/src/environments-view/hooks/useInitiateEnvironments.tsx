import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useShouldRefetchPerProject } from "@/hooks/useShouldRefetchPerProject";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all environments of a project. Will re-fetch when the browser tab regains focus.
 */
export const useInitiateEnvironments = () => {
  const { projectUuid } = useCustomRoute();

  const { fetchEnvironments } = useFetchEnvironments(projectUuid);
  const validate = useEnvironmentsApi((state) => state.validate);

  const shouldRefetch = useShouldRefetchPerProject();
  const shouldFetch = useEnvironmentsApi(
    (state) => hasValue(projectUuid) && (!state.environments || shouldRefetch)
  );

  const fetchAndValidate = React.useCallback(async () => {
    if (projectUuid) {
      await fetchEnvironments();
      await validate();
    }
  }, [fetchEnvironments, validate, projectUuid]);

  React.useEffect(() => {
    if (shouldFetch) fetchAndValidate();
  }, [shouldFetch, fetchAndValidate]);
};
