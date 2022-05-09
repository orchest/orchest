import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import JobList from "./JobList";

const JobsView: React.FC = () => {
  const { projectUuid } = useCustomRoute();

  useSendAnalyticEvent("view load", { name: siteMap.jobs.path });

  return (
    <Layout>
      <ProjectBasedView>
        <JobList projectUuid={projectUuid}></JobList>
      </ProjectBasedView>
    </Layout>
  );
};

export default JobsView;
