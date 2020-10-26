import React, { Fragment } from 'react';
import ExperimentList from '../components/ExperimentList';
import ProjectSelector from '../components/ProjectSelector';

class ExperimentsView extends React.Component {

  constructor(props) {
    super(props);

    this.state = {}

    if(props.project_uuid !== undefined){
      this.state.project_uuid = props.project_uuid;
    }
  }

  onChangeProject(project_uuid) {

    if (project_uuid !== undefined) {
      this.setState({
        // TODO: make key unneccesary? --> ExperimentList doesn't handle property swapping yet
        experimentList: <ExperimentList key={project_uuid} project_uuid={project_uuid} />
      })
    }

    this.setState({
      project_uuid: project_uuid,
    });
  }

  render() {

    return <div className="view-page">
      <div className="push-down">
        <ProjectSelector onChangeProject={this.onChangeProject.bind(this)} project_uuid={this.state.project_uuid} />
      </div>
      {(() => {
        if (this.state.project_uuid !== undefined) {
          return this.state.experimentList
        }
      })()}
    </div>
  }
}

export default ExperimentsView;