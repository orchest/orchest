// @ts-check
import React from "react";
import { OrchestSessionsConsumer, useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";

/**
 * @param {Object} props
 * @param { import('../types').IOrchestState['project_uuid'] } props.project_uuid
 */
const PipelinesView = (props) => {
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
