import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { EnvironmentState } from "@/types";
import React from "react";

/**
 * Fetch all environments of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchEnvironments = () => {
  const { projectUuid } = useCustomRoute();

  const { run, status } = useAsync<EnvironmentState[] | undefined>();

  const shouldFetchOnMount = useEnvironmentsApi(
    (state) => !Boolean(state.environments) && status !== "PENDING"
  );

  const fetchEnvironments = useEnvironmentsApi((state) => state.fetch);
  const validate = useEnvironmentsApi((state) => state.validate);

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  const shouldFetch =
    shouldFetchOnMount || hasRegainedFocus || hasChangedProject;

  const fetchAndValidate = React.useCallback(async () => {
    try {
      if (projectUuid) {
        await run(fetchEnvironments(projectUuid));
        await validate();
      }
    } catch (error) {
      if (!error.isCanceled) console.error(error);
    }
  }, [fetchEnvironments, validate, projectUuid, run]);

  React.useEffect(() => {
    if (shouldFetch) {
      fetchAndValidate();
    }
  }, [shouldFetch, fetchAndValidate]);
};
