import React from "react";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useCustomRoute } from "@/hooks/useCustomRoute";

const EnvironmentsView: React.FC<TViewProps> = (props) => {
  useDocumentTitle(props.title);
  const { projectId } = useCustomRoute();

  return (
    <Layout>
      <ProjectBasedView projectId={projectId}>
        <EnvironmentList projectId={projectId} />
      </ProjectBasedView>
    </Layout>
  );
};

export default EnvironmentsView;
