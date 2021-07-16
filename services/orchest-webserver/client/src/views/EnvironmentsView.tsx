import * as React from "react";
import type { IViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IEnvironmentsViewProps
  extends IViewProps,
    IProjectBasedViewProps {}

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
