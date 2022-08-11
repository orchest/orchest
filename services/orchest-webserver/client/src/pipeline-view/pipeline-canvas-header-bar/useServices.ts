import { useCustomRoute } from "@/hooks/useCustomRoute";
import { filterServices } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const useServices = (jobRunRunning: boolean) => {
  const { jobUuid } = useCustomRoute();
  const { runUuid, pipelineJson } = usePipelineDataContext();
  const { session } = useInteractiveRunsContext();
  const [anchor, setAnchor] = React.useState<Element>();

  const showServices = React.useCallback((e: React.MouseEvent) => {
    setAnchor(e.currentTarget);
  }, []);

  const hideServices = React.useCallback(() => {
    setAnchor(undefined);
  }, []);

  const isJobRun = hasValue(jobUuid) && hasValue(runUuid);

  const isServicesUnavailable =
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
