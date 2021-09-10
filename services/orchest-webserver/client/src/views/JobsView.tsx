import React from "react";

import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";
import JobList from "@/components/JobList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useCustomRoute } from "@/hooks/useCustomRoute";

const JobsView: React.FC<TViewProps> = (props) => {
  useDocumentTitle(props.title);
  const { projectId } = useCustomRoute();

  return (
    <Layout>
      <ProjectBasedView projectId={projectId}>
        <JobList projectId={projectId}></JobList>
      </ProjectBasedView>
    </Layout>
  );
};

export default JobsView;
