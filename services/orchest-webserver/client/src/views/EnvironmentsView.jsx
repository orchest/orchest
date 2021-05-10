// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";
import EnvironmentList from "../components/EnvironmentList";
import ProjectBasedView from "../components/ProjectBasedView";

const EnvironmentsView = (props) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "environments" });
    return () => dispatch({ type: "clearView" });
  }, []);

  let childViewProperties = {};

  if (props.project_uuid) {
    childViewProperties.project_uuid = props.project_uuid;
  }

  return (
    <ProjectBasedView
      project_uuid={props.project_uuid}
      childView={EnvironmentList}
      childViewProperties={childViewProperties}
    />
  );
};

EnvironmentsView.defaultProps = {
  queryArgs: {},
};

export default EnvironmentsView;
