import React from "react";
import EnvironmentList from "../components/EnvironmentList";
import ProjectBasedView from "../components/ProjectBasedView";

class EnvironmentsView extends React.Component {
  render() {
    let childViewProperties = {};

    if (this.props.project_uuid) {
      childViewProperties.project_uuid = this.props.project_uuid;
    }

    return (
      <ProjectBasedView
        project_uuid={this.props.project_uuid}
        childView={EnvironmentList}
        childViewProperties={childViewProperties}
      />
    );
  }
}

EnvironmentsView.defaultProps = {
  queryArgs: {},
};

export default EnvironmentsView;
