import JobList from "@/components/JobList";
import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

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
