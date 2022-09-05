import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";

/**
 * Fetch all environments of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchEnvironments = () => {
  const { projectUuid } = useCustomRoute();

  const shouldFetchOnMount = useEnvironmentsApi(
    (state) => !Boolean(state.environments) && !state.isFetchingAll
  );

  const fetchEnvironments = useEnvironmentsApi((state) => state.fetch);
  const validate = useEnvironmentsApi((state) => state.validate);

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  const shouldFetch =
    shouldFetchOnMount || hasRegainedFocus || hasChangedProject;

  const fetchAndValidate = React.useCallback(async () => {
    if (projectUuid) {
      await fetchEnvironments(projectUuid);
      validate();
    }
  }, [fetchEnvironments, validate, projectUuid]);

  React.useEffect(() => {
    if (shouldFetch) {
      fetchAndValidate();
    }
  }, [shouldFetch, fetchAndValidate]);
};
