import {
  EnvironmentsApi,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";
import { useReportEnvironmentsError } from "./useReportEnvironmentsError";

/**
 * Fetch all environments of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchEnvironments = () => {
  const { projectUuid } = useCustomRoute();
  useReportEnvironmentsError();

  const [
    shouldFetchOnMount,
    fetchEnvironments,
    validate,
  ] = useEnvironmentsApi((state: EnvironmentsApi) => [
    !Boolean(state.environments) && !state.isFetchingAll,
    state.fetch,
    state.validate,
  ]);

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
