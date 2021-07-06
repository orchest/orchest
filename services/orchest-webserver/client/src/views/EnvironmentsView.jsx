// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView from "@/components/ProjectBasedView";

/**
 * @param {Object} props
 * @param { import('../types').IOrchestState['project_uuid'] } props.project_uuid
 */
const EnvironmentsView = (props) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "environments" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <Layout>
      <ProjectBasedView
        project_uuid={props.project_uuid}
        childView={EnvironmentList}
      />
    </Layout>
  );
};

EnvironmentsView.defaultProps = {
  queryArgs: {},
};

export default EnvironmentsView;
