import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { useReportEnvironmentsError } from "./useReportEnvironmentsError";

const selector = (state: EnvironmentsApiState) => state.fetch;

export const useFetchEnvironments = (projectUuid?: string) => {
  useReportEnvironmentsError();
  const fetchEnvironments = useEnvironmentsApi(selector);
  React.useEffect(() => {
    if (projectUuid) fetchEnvironments(projectUuid);
  }, [projectUuid, fetchEnvironments]);
};
