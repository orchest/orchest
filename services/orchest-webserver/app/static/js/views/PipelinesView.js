import React from "react";
import ProjectFilePicker from "../components/ProjectFilePicker";

class PipelinesView extends React.Component {
  
  render() {
    return (
      //<ProjectBasedView childView={PipelineList} />
      <ProjectFilePicker project_uuid={"4f2e821e-5ae7-41ef-baac-22fbfbf656bc"} />
    );
  }
}

export default PipelinesView;
