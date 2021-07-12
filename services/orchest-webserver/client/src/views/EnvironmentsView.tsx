import * as React from "react";
import type { IOrchestState } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView from "@/components/ProjectBasedView";

export interface IEnvironmentsViewProps {
  project_uuid: IOrchestState["project_uuid"];
  queryArgs?: any;
}

const EnvironmentsView: React.FC<IEnvironmentsViewProps> = (props) => {
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
