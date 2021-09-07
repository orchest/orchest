import React from "react";
import { useParams } from "react-router-dom";
import type { TViewProps } from "@/types";
import { OrchestSessionsConsumer, useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IPipelinesViewProps
  extends TViewProps,
    IProjectBasedViewProps {}

const PipelinesView: React.FC<IPipelinesViewProps> = () => {
  const { dispatch } = useOrchest();
  const { projectId } = useParams<{ projectId: string }>();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "pipelines" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <OrchestSessionsConsumer>
      <Layout>
        <ProjectBasedView projectId={projectId} childView={PipelineList} />
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default PipelinesView;
