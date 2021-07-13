import * as React from "react";
import type { IOrchestState } from "@/types";

import { OrchestSessionsConsumer, useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";

export interface IPipelinesViewProps {
  project_uuid: IOrchestState["project_uuid"];
}

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
