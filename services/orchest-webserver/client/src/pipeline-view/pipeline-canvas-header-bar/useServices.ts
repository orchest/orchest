import { useCustomRoute } from "@/hooks/useCustomRoute";
import { filterServices } from "@/utils/webserver-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useInteractiveRuns } from "../hooks/useInteractiveRuns";

export const useServices = (jobRunRunning: boolean) => {
  const { jobUuid } = useCustomRoute();
  const { pipelineJson, isSnapshot, isJobRun } = usePipelineDataContext();
  const { session } = useInteractiveRuns();
  const [anchor, setAnchor] = React.useState<Element>();

  const showServices = React.useCallback((e: React.MouseEvent) => {
    setAnchor(e.currentTarget);
  }, []);

  const hideServices = React.useCallback(() => {
    setAnchor(undefined);
  }, []);

  const isServicesUnavailable =
    isSnapshot ||
    // Not a job run, so it is an interactive run, services are only available if session is RUNNING.
    (!isJobRun && session?.status !== "RUNNING") ||
    // It is a job run (non-interactive run), we are unable to check its actual session,
    // but we can check its job run status,
    (isJobRun && pipelineJson && !jobRunRunning);

  const services = React.useMemo(() => {
    if (isServicesUnavailable) return null;
    const allServices = isJobRun
      ? pipelineJson?.services || {}
      : session?.user_services || {};

    // Filter services based on scope
    return filterServices(
      allServices,
      jobUuid ? "noninteractive" : "interactive"
    );
  }, [pipelineJson, session, jobUuid, isJobRun, isServicesUnavailable]);

  return {
    anchor,
    services,
    showServices,
    hideServices,
  };
};
