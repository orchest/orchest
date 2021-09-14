import React from "react";

import { Layout } from "@/components/Layout";
import JobList from "@/components/JobList";
import ProjectBasedView from "@/components/ProjectBasedView";

import { useCustomRoute } from "@/hooks/useCustomRoute";

const JobsView: React.FC = () => {
  const { projectUuid } = useCustomRoute();

  return (
    <Layout>
      <ProjectBasedView projectUuid={projectUuid}>
        <JobList projectUuid={projectUuid}></JobList>
      </ProjectBasedView>
    </Layout>
  );
};

export default JobsView;
