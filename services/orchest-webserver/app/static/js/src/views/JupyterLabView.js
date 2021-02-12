import React from "react";
import PipelineView from "./PipelineView";

class JupyterLabView extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (orchest.jupyter.baseAddress == "") {
      orchest.loadView(PipelineView, {
        pipeline_uuid: this.props.pipeline_uuid,
        project_uuid: this.props.project_uuid,
      });
    } else {
      orchest.headerBarComponent.updateCurrentView("jupyter");
      orchest.jupyter.show();
      $(orchest.reactRoot).addClass("hidden");
    }
  }

  render() {
    return <div className="view-page jupyter no-padding"></div>;
  }
}

export default JupyterLabView;
