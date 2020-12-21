import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { RefManager } from "../lib/utils/all";

class MultiPipelinestepDetails extends React.Component {
  constructor(props) {
    super(props);

    this.refManager = new RefManager();
  }

  componentWillUnmount() {}

  componentDidMount() {}

  render() {
    return (
      <div className={"pipeline-details multi-step pane"}>
        <div className="overflowable multi-step-pane">
          <div className="dummy-steps">
            <div className="dummy-step"></div>
            <div className="dummy-step"></div>
          </div>
        </div>
        <div className={"action-buttons-bottom"}>
          <div className={"general-actions"}>
            <MDCButtonReact
              icon="close"
              label="Close"
              onClick={this.props.onClose.bind(this)}
            />

            {(() => {
              if (!this.props.readOnly) {
                return (
                  <MDCButtonReact
                    icon="delete"
                    label="Delete"
                    onClick={this.props.onDelete.bind(this)}
                  />
                );
              }
            })()}
          </div>
        </div>
      </div>
    );
  }
}

export default MultiPipelinestepDetails;
