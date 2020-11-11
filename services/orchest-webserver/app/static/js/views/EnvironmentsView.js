import React from "react";
import EnvironmentList from "../components/EnvironmentList";
import ProjectBasedView from "./ProjectBasedView";

class EnvironmentsView extends React.Component {
  render() {
    let childViewProperties = {};

    if(this.props.project_uuid){
      childViewProperties.project_uuid = this.props.project_uuid;
    }

    return (
      <ProjectBasedView childView={EnvironmentList} childViewProperties={childViewProperties} />
    );
  }
}

export default EnvironmentsView;
