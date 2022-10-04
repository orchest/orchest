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
  const { projectUuid: projectUuidFromRoute } = useCustomRoute();
  const projectUuid = useEnvironmentsApi((state) => state.projectUuid);

  const setEnvironments = useEnvironmentsApi((state) => state.setEnvironments);

  React.useEffect(() => {
    if (hasValue(projectUuid) && projectUuid !== projectUuidFromRoute) {
      setEnvironments(undefined);
    }
  }, [projectUuid, projectUuidFromRoute, setEnvironments]);

  const shouldRefetch = useShouldRefetchPerProject();
  const shouldFetch = useEnvironmentsApi(
    (state) =>
      hasValue(projectUuidFromRoute) &&
      (!hasValue(state.environments) || shouldRefetch)
  );

  const { fetchEnvironments } = useFetchEnvironments();

  const validate = useEnvironmentsApi((state) => state.validate);
  const fetchAndValidate = React.useCallback(async () => {
    if (projectUuidFromRoute) {
      await fetchEnvironments(projectUuidFromRoute);
      await validate();
    }
  }, [fetchEnvironments, validate, projectUuidFromRoute]);

  React.useEffect(() => {
    if (shouldFetch) {
      fetchAndValidate();
    }
  }, [shouldFetch, fetchAndValidate]);
};
