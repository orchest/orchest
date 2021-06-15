// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import JobList from "@/components/JobList";
import ProjectBasedView from "@/components/ProjectBasedView";

/**
 * @param {Object} props
 * @param { import('../types').IOrchestState['project_uuid'] } props.project_uuid
 */
const JobsView = (props) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "setView", payload: "jobs" });
    return () => dispatch({ type: "clearView" });
  }, []);

  return (
    <Layout>
      <ProjectBasedView project_uuid={props.project_uuid} childView={JobList} />
    </Layout>
  );
};

export default JobsView;
