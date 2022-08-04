import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
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

  const isTabFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(isTabFocused);

  const shouldRefetch = isTabFocused && hasBrowserFocusChanged;

  const [
    shouldFetch,
    fetchEnvironments,
  ] = useEnvironmentsApi((state: EnvironmentsApiState) => [
    !Boolean(state.environments) && !state.isFetchingAll,
    state.fetch,
  ]);

  React.useEffect(() => {
    if (projectUuid && (shouldFetch || shouldRefetch)) {
      fetchEnvironments(projectUuid);
    }
  }, [projectUuid, shouldFetch, shouldRefetch, fetchEnvironments]);
};
