import React from "react";
import { useParams } from "react-router-dom";

import type { TViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import JobList from "@/components/JobList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IJobsViewProps extends TViewProps, IProjectBasedViewProps {}

const JobsView: React.FC<IJobsViewProps> = () => {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Layout>
      <ProjectBasedView projectId={projectId}>
        <JobList projectId={projectId}></JobList>
      </ProjectBasedView>
    </Layout>
  );
};

export default JobsView;
