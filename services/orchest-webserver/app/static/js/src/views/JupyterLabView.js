import React from "react";
import PipelineView from "./PipelineView";

class JupyterLabView extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (orchest.jupyter.baseAddress == "") {
      orchest.loadView(PipelineView, {
        queryArgs: {
          pipeline_uuid: this.props.queryArgs.pipeline_uuid,
          project_uuid: this.props.queryArgs.project_uuid,
        },
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
