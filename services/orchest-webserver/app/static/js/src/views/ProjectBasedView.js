import React from "react";
import ProjectSelector from "../components/ProjectSelector";

class ProjectBasedView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {};

    if (props.project_uuid !== undefined) {
      this.state.project_uuid = props.project_uuid;
    }
  }

  onChangeProject(project_uuid) {
    this.setState({
      project_uuid: project_uuid,
    });
  }

  render() {
    let TagName = this.props.childView;

    return (
      <div className="view-page">
        <div className="push-down">
          <ProjectSelector
            onChangeProject={this.onChangeProject.bind(this)}
            project_uuid={this.state.project_uuid}
          />
        </div>

        {(() => {
          if (this.state.project_uuid) {
            // TODO: remove key: ... property on childview. Requires al childviews to support property swapping.
            return (
              <TagName
                {...{
                  ...this.props.childViewProps,
                  ...{
                    project_uuid: this.state.project_uuid,
                    key: this.state.project_uuid,
                  },
                }}
              />
            );
          }
        })()}
      </div>
    );
  }
}

export default ProjectBasedView;
