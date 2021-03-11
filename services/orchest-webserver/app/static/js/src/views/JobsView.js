import React from "react";
import JobList from "../components/JobList";
import ProjectBasedView from "../components/ProjectBasedView";

class JobsView extends React.Component {
  render() {
    return (
      <ProjectBasedView
        project_uuid={this.props.project_uuid}
        childView={JobList}
      />
    );
  }
}

export default JobsView;
