import React from "react";
import JobList from "../components/JobList";
import ProjectBasedView from "./ProjectBasedView";

class JobsView extends React.Component {
  render() {
    return <ProjectBasedView childView={JobList} />;
  }
}

export default JobsView;
