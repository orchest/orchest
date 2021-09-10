import React from "react";
import { useParams } from "react-router-dom";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IEnvironmentsViewProps
  extends TViewProps,
    IProjectBasedViewProps {}

const EnvironmentsView: React.FC<IEnvironmentsViewProps> = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Layout>
      <ProjectBasedView projectId={projectId}>
        <EnvironmentList projectId={projectId} />
      </ProjectBasedView>
    </Layout>
  );
};

export default EnvironmentsView;
