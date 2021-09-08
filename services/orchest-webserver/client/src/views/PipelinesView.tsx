import React from "react";
import { useParams } from "react-router-dom";
import type { TViewProps } from "@/types";
import { OrchestSessionsConsumer } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IPipelinesViewProps
  extends TViewProps,
    IProjectBasedViewProps {}

const PipelinesView: React.FC<IPipelinesViewProps> = () => {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <OrchestSessionsConsumer>
      <Layout>
        <ProjectBasedView projectId={projectId}>
          <PipelineList projectId={projectId} key={projectId} />
        </ProjectBasedView>
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default PipelinesView;
