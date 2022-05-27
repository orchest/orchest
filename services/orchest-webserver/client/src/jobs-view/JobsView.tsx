import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import JobList from "./JobList";

const JobsView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.jobs.path });

  return (
    <Layout>
      <ProjectBasedView>
        <JobList />
      </ProjectBasedView>
    </Layout>
  );
};

export default JobsView;
