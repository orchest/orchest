import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFocusBrowserTab } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";
import { useReportEnvironmentsError } from "./useReportEnvironmentsError";

/**
 * Fetch all environments of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchEnvironments = () => {
  const { projectUuid } = useCustomRoute();
  useReportEnvironmentsError();

  const shouldFetchOnMount = useEnvironmentsApi(
    (state) => !Boolean(state.environments) && !state.isFetchingAll
  );

  const fetchEnvironments = useEnvironmentsApi((state) => state.fetch);
  const validate = useEnvironmentsApi((state) => state.validate);

  const isTabFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(isTabFocused);

  const hasRegainedFocus = isTabFocused && hasBrowserFocusChanged;
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
