import * as React from "react";
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

const PipelinesView: React.FC<IPipelinesViewProps> = (props) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "pipelines" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <OrchestSessionsConsumer>
      <Layout>
        <ProjectBasedView
          project_uuid={props.project_uuid}
          childView={PipelineList}
        />
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default PipelinesView;
