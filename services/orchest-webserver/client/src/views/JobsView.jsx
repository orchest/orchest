// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";
import JobList from "../components/JobList";
import ProjectBasedView from "../components/ProjectBasedView";

const JobsView = (props) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "jobs" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <ProjectBasedView project_uuid={props.project_uuid} childView={JobList} />
  );
};

export default JobsView;
