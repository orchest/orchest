import { ViewLayout } from "@/components/layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { JobHeader } from "./job-view/JobHeader";
import { JobView } from "./job-view/JobView";
import { JobMenuList } from "./JobMenuList";

export const JobsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <ViewLayout sidePanel={<JobMenuList />} header={<JobHeader />}>
      <JobView />
    </ViewLayout>
  );
};
