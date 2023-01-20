import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { ViewLayout } from "@/components/layout/ViewLayout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { JobHeader } from "./job-view/JobHeader";
import { JobView } from "./job-view/JobView";
import { JobMenuList } from "./JobMenuList";

export const JobsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });
  const hasJobs = useProjectJobsApi((state) => state.jobs?.length !== 0);

  return (
    <ViewLayout
      sidePanel={<JobMenuList />}
      header={hasJobs ? () => <JobHeader /> : undefined}
    >
      <JobView />
    </ViewLayout>
  );
};
