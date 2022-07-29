import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { useReportEnvironmentsError } from "./useReportEnvironmentsError";

const selector = (state: EnvironmentsApiState) => state.fetch;

/**
 * Fetch all environments of a project. Should be placed at the entrypoint
 * of project-specific views, e.g. jobs, pipelines.
 */
export const useFetchEnvironments = (projectUuid?: string) => {
  useReportEnvironmentsError();
  const fetchEnvironments = useEnvironmentsApi(selector);
  React.useEffect(() => {
    if (projectUuid) fetchEnvironments(projectUuid);
  }, [projectUuid, fetchEnvironments]);
};
