import React from "react";
import { useParams } from "react-router-dom";
import type { TViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView, {
  IProjectBasedViewProps,
} from "@/components/ProjectBasedView";

export interface IEnvironmentsViewProps
  extends TViewProps,
    IProjectBasedViewProps {}

const EnvironmentsView: React.FC<IEnvironmentsViewProps> = () => {
  const { dispatch } = useOrchest();
  const { projectId } = useParams<{ projectId: string }>();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "environments" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <Layout>
      <ProjectBasedView projectId={projectId} childView={EnvironmentList} />
    </Layout>
  );
};

EnvironmentsView.defaultProps = {
  queryArgs: {},
};

export default EnvironmentsView;
